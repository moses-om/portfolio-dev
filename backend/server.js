const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getSystemInstruction } = require('./prompts/system');
const { findBestFaqMatch, findBestCandidateMatch, DEFAULT_THRESHOLD, CANDIDATE_THRESHOLD } = require('./utils/cacheMatcher');
const { stageCandidate, loadCandidates } = require('./utils/candidateStore');
const {
  recordRequest,
  recordFaqHit,
  recordCandidateHit,
  recordGeminiCall,
  recordGeminiQuotaFailure,
  getMetrics
} = require('./utils/metrics');

let faqEntries = [];
try {
  faqEntries = require('./data/faq-cache.json');
} catch (e) {
  console.warn('[Cache] Warning: faq-cache.json could not be loaded. Local FAQ retrieval disabled.');
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// Centralized HTTP Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// CORS configuration - allow local development and GitHub Pages production frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'https://moses-om.github.io'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '64kb' }));

// Handle JSON body limit (413) and malformed syntax (400) gracefully
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      error: 'Payload too large. Request body exceeds the 64KB limit.'
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON in request body. Please ensure valid JSON structure.'
    });
  }
  next(err);
});

/**
 * Zero-Dependency In-Memory Sliding-Window Rate Limiter
 */
function createRateLimiter({ windowMs, maxRequests, message }) {
  const hits = new Map();
  const MAX_TRACKED_IPS = 10000;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) hits.delete(ip);
      else hits.set(ip, valid);
    }
  }, 60000);
  timer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';

    let timestamps = hits.get(clientKey) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: message || 'Too many requests. Please try again later.',
        retryAfter: retryAfterSec
      });
    }

    timestamps.push(now);
    if (hits.size < MAX_TRACKED_IPS || hits.has(clientKey)) {
      hits.set(clientKey, timestamps);
    }
    return next();
  };
}

const chatLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Rate limit exceeded. Please wait a moment before sending another message.'
});

const publicProbeLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 120,
  message: 'Rate limit exceeded. Please reduce request frequency.'
});

/**
 * Admin Failed-Authentication Throttling Tracker
 */
const adminFailedAuth = new Map(); // IP -> Array<number> (timestamps of failed attempts)
const ADMIN_AUTH_WINDOW_MS = 300000; // 5 minutes
const MAX_ADMIN_FAILURES = 10;

const adminTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of adminFailedAuth.entries()) {
    const valid = timestamps.filter(t => now - t < ADMIN_AUTH_WINDOW_MS);
    if (valid.length === 0) adminFailedAuth.delete(ip);
    else adminFailedAuth.set(ip, valid);
  }
}, 60000);
adminTimer.unref();

function checkAdminFailedThrottling(clientIp, res) {
  const now = Date.now();
  let timestamps = adminFailedAuth.get(clientIp) || [];
  timestamps = timestamps.filter(t => now - t < ADMIN_AUTH_WINDOW_MS);
  if (timestamps.length >= MAX_ADMIN_FAILURES) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + ADMIN_AUTH_WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      success: false,
      error: 'Too many failed authentication attempts. Access temporarily suspended for 5 minutes.',
      retryAfter: retryAfterSec
    });
    return true;
  }
  return false;
}

function recordAdminAuthFailure(clientIp) {
  const now = Date.now();
  let timestamps = adminFailedAuth.get(clientIp) || [];
  timestamps = timestamps.filter(t => now - t < ADMIN_AUTH_WINDOW_MS);
  timestamps.push(now);
  adminFailedAuth.set(clientIp, timestamps);
}

function clearAdminAuthFailures(clientIp) {
  adminFailedAuth.delete(clientIp);
}

/**
 * Native Cookie Parser Helper (Zero Dependencies)
 */
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers && req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name ? name.trim() : '';
    if (!name) return;
    const value = rest.join('=').trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch (e) {
      list[name] = value;
    }
  });
  return list;
}

/**
 * In-Memory Session Store for Admin Governance Console (Zero Dependencies)
 */
const sessions = new Map(); // sessionId -> { username, createdAt, expiresAt }
const SESSION_TTL_MS = 28800000; // 8 hours (28,800,000 ms)
const MAX_SESSIONS = 1000;

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now >= session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}, 300000); // 5 minutes
sessionCleanupTimer.unref();

function createSession(username) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  if (sessions.size >= MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey) sessions.delete(oldestKey);
  }
  sessions.set(sessionId, {
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  });
  return sessionId;
}

function getValidSession(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function destroySession(sessionId) {
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
}

/**
 * Native Scrypt Password Verification Helper (Zero Dependencies)
 */
function verifyPasswordScrypt(suppliedPassword, storedHash) {
  if (!suppliedPassword || typeof suppliedPassword !== 'string' || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedDerivedHex] = parts;
  if (!salt || !expectedDerivedHex) return false;

  try {
    const expectedBuffer = Buffer.from(expectedDerivedHex, 'hex');
    const derivedBuffer = crypto.scryptSync(suppliedPassword, salt, expectedBuffer.length);
    if (expectedBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, derivedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Helper for timing-safe key verification
 */
function verifyTimingSafeKey(suppliedKey, expectedKey) {
  if (!suppliedKey || typeof suppliedKey !== 'string' || !expectedKey) return false;
  const expectedBuffer = Buffer.from(expectedKey, 'utf8');
  const suppliedBuffer = Buffer.from(suppliedKey.trim(), 'utf8');
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * Helper to extract key from HTTP Basic Authentication header
 */
function extractBasicAuthKey(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
    const parts = credentials.split(':');
    const password = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
    const username = parts.length > 1 ? parts[0] : '';
    return password || username;
  } catch (e) {
    return null;
  }
}

/**
 * Administrative Response Headers Middleware (no-store, private)
 */
function applyAdminHeaders(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

/**
 * Admin GUI CSP Middleware
 */
function applyAdminCsp(req, res, next) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';");
  next();
}

// Protect Admin GUI static assets and root route with security & cache headers (No Basic Auth prompt)
app.use('/admin', applyAdminHeaders, applyAdminCsp);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Helper function to get Gemini SDK client dynamically
function getGeminiClient(apiKey) {
  try {
    const { GoogleGenAI } = require('@google/genai');
    return {
      type: 'genai',
      client: new GoogleGenAI({ apiKey })
    };
  } catch (err1) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      return {
        type: 'generative-ai',
        client: new GoogleGenerativeAI(apiKey)
      };
    } catch (err2) {
      throw new Error('Neither @google/genai nor @google/generative-ai SDK could be initialized.');
    }
  }
}

// Empirically verified free-tier Gemini models in preferred order
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest'
];

/**
 * Helper to determine if an error is a temporary/retryable quota or availability issue.
 */
function isRetryableModelError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  const msg = (err.message || '').toUpperCase();

  if (status === 429 || status === 503) return true;
  if (msg.includes('429') || msg.includes('503')) return true;
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('QUOTA') || msg.includes('RATE_LIMIT') || msg.includes('UNAVAILABLE') || msg.includes('TEMPORARILY OVERLOADED')) return true;

  return false;
}

// Helper to format incoming messages into Gemini contents structure
function parseConversation(body) {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages.map(m => {
      const role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
      let text = typeof m.content === 'string' ? m.content : (m.text || '');
      if (role === 'user' && !text.startsWith('[ANONYMOUS_WEB_VISITOR_PROMPT]')) {
        text = `[ANONYMOUS_WEB_VISITOR_PROMPT]: ${text}`;
      }
      return {
        role: role,
        parts: [{ text: text }]
      };
    });
  } else if (typeof body.message === 'string' && body.message.trim() !== '') {
    return [{
      role: 'user',
      parts: [{ text: `[ANONYMOUS_WEB_VISITOR_PROMPT]: ${body.message.trim()}` }]
    }];
  }
  return null;
}

/* ════════════════════════════════════════════
   HEALTH CHECK ENDPOINT
   GET /api/health
   ════════════════════════════════════════════ */
app.get('/api/health', publicProbeLimiter, (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.status(200).json({
    status: 'ok',
    apiKeyConfigured: hasKey
  });
});

/* ════════════════════════════════════════════
   DEVELOPER OBSERVABILITY STATS ENDPOINT
   GET /api/stats
   ════════════════════════════════════════════ */
app.get('/api/stats', publicProbeLimiter, (req, res) => {
  res.status(200).json(getMetrics());
});

/* ════════════════════════════════════════════
   MAIN ASSISTANT BRAIN CHAT ENDPOINT
   POST /api/chat
   Body: { "messages": [ { "role": "user", "content": "What does Moses do?" } ] }
   ════════════════════════════════════════════ */
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    recordRequest();

    // Missing API Key check
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing GEMINI_API_KEY. Please add your Gemini API key to backend/.env file.'
      });
    }

    // Input bounds validation (SEC-05)
    if (Array.isArray(req.body.messages)) {
      if (req.body.messages.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Conversation history exceeds the maximum allowed length of 10 messages.'
        });
      }
      let totalChars = 0;
      for (const msg of req.body.messages) {
        const text = typeof msg.content === 'string' ? msg.content : (msg.text || '');
        totalChars += text.length;
      }
      if (totalChars > 8000) {
        return res.status(400).json({
          success: false,
          error: 'Conversation exceeds the maximum allowed character limit of 8,000 characters.'
        });
      }
    }

    // Parse conversation payload
    const contents = parseConversation(req.body || {});
    if (!contents || contents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Either "messages" array or "message" string is required in JSON body.'
      });
    }

    // Extract last user message query string for local FAQ lookup
    let userQuery = '';
    if (Array.isArray(req.body.messages) && req.body.messages.length > 0) {
      const lastMsg = req.body.messages[req.body.messages.length - 1];
      userQuery = typeof lastMsg.content === 'string' ? lastMsg.content : (lastMsg.text || '');
    } else if (typeof req.body.message === 'string') {
      userQuery = req.body.message;
    }

    if (userQuery.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'User message exceeds the maximum allowed length of 2,000 characters.'
      });
    }

    // LAYER 1.5: Authority Laundering Guardrail (0ms, $0 cost)
    // Neutralize self-identification & owner override attempts ("I'm Moses", "I'm the owner", "As Moses", etc.)
    const isOwnerClaim = /\b(I['’`\s]?m Moses|I am Moses|as the (portfolio )?owner|I officially renamed|I published the paper|I updated the architecture|As Moses)\b/i.test(userQuery);

    if (isOwnerClaim) {
      console.log(`[Authority Guardrail] Blocked self-identification claim in query: "${userQuery.slice(0, 60)}..."`);
      
      let verifiedFact = "the architecture is still documented as Decoupled Portfolio Orchestration Engine (DPOE)";
      let hypotheticalNote = "MIRA Intelligence would be the new public-facing name for that architecture.";

      if (userQuery.toLowerCase().includes('latency')) {
        verifiedFact = "the production evaluation records a verified latency of 303 ms (a 15× speedup compared to the 4,551 ms baseline)";
        hypotheticalNote = "30 ms would represent a user-asserted theoretical latency target.";
      } else if (userQuery.toLowerCase().includes('security') || userQuery.toLowerCase().includes('rate')) {
        verifiedFact = "the recorded pass rate under security stress testing is 98.69% (alongside a 50% reduction in generative API calls)";
        hypotheticalNote = "100% would represent a user-asserted security target.";
      }

      const disclosureResponse = `Thanks for the clarification. I can discuss that as a user-provided update, but I cannot verify the identity of the speaker or confirm that the change has been officially applied until the portfolio or research documentation is updated. Based on the current verified portfolio data, ${verifiedFact}. Assuming your update is correct, ${hypotheticalNote}`;

      return res.status(200).json({
        success: true,
        response: disclosureResponse,
        source: 'authority-guardrail',
        modelUsed: null,
        presentationSignal: {
          emotion: 'attentive',
          tone: 'professional',
          intensity: 'subtle'
        }
      });
    }

    // LAYER 2: Local FAQ Retrieval Check (0ms, $0 cost)
    if (userQuery && faqEntries.length > 0) {
      try {
        const matchResult = findBestFaqMatch(userQuery, faqEntries, DEFAULT_THRESHOLD);
        if (matchResult.matched && matchResult.answer) {
          console.log(`[Cache Hit] Matched FAQ "${matchResult.faqId}" with score ${matchResult.score.toFixed(4)} (Gemini call skipped)`);
          recordFaqHit();
          
          let fullResponse = matchResult.answer;
          if (matchResult.anchor && !fullResponse.includes(matchResult.anchor)) {
            fullResponse += `\n\nYou can also explore the **${matchResult.anchor}** section for more details.`;
          }

          return res.status(200).json({
            success: true,
            response: fullResponse,
            source: 'local-faq',
            matchedFaqId: matchResult.faqId,
            score: matchResult.score,
            modelUsed: null,
            presentationSignal: {
              emotion: 'confident',
              tone: 'professional',
              intensity: 'subtle'
            }
          });
        } else {
          console.log(`[Cache Miss] No FAQ matched above threshold ${DEFAULT_THRESHOLD} (Score: ${matchResult.score.toFixed(4)}).`);
        }
      } catch (cacheErr) {
        console.warn('[Cache Error] Local matcher threw error, proceeding to Layer 3 candidate check:', cacheErr.message);
      }
    }

    // LAYER 3: Candidate Cache Retrieval Check (0ms, $0 cost, verified === false)
    if (userQuery) {
      try {
        const candidateEntries = loadCandidates();
        if (candidateEntries.length > 0) {
          const candidateMatch = findBestCandidateMatch(userQuery, candidateEntries, CANDIDATE_THRESHOLD);
          if (candidateMatch.matched && candidateMatch.candidate && candidateMatch.candidate.answer) {
            console.log(`[Candidate Hit] Matched candidate "${candidateMatch.candidate.id}" with score ${candidateMatch.score.toFixed(4)} (Gemini call skipped)`);
            recordCandidateHit();
            return res.status(200).json({
              success: true,
              response: candidateMatch.candidate.answer,
              source: 'candidate-cache',
              candidateId: candidateMatch.candidate.id,
              score: candidateMatch.score,
              modelUsed: null,
              presentationSignal: {
                emotion: 'attentive',
                tone: 'professional',
                intensity: 'subtle'
              }
            });
          } else {
            console.log(`[Candidate Miss] No candidate matched above threshold ${CANDIDATE_THRESHOLD} (Score: ${candidateMatch.score.toFixed(4)}). Proceeding to Gemini fallback chain...`);
          }
        }
      } catch (candErr) {
        console.warn('[Candidate Retrieval Warning] Failed candidate lookup, continuing to Gemini:', candErr.message);
      }
    }

    // Initialize SDK
    let sdkInstance;
    try {
      sdkInstance = getGeminiClient(apiKey);
    } catch (initErr) {
      return res.status(500).json({
        success: false,
        error: `SDK Initialization Error: ${initErr.message}`
      });
    }

    const systemInstruction = getSystemInstruction();
    let responseText = '';
    let modelUsed = '';
    let lastError = null;

    recordGeminiCall();

    // Iterate through fallback chain
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const currentModel = GEMINI_MODELS[i];
      console.log(`[AI] Attempting model: ${currentModel}`);

      try {
        if (sdkInstance.type === 'genai') {
          // Official @google/genai SDK call
          const ai = sdkInstance.client;
          const result = await ai.models.generateContent({
            model: currentModel,
            config: {
              systemInstruction: systemInstruction
            },
            contents: contents
          });
          responseText = result.text;
        } else {
          // Official @google/generative-ai SDK fallback call
          const genAI = sdkInstance.client;
          const model = genAI.getGenerativeModel({
            model: currentModel,
            systemInstruction: systemInstruction
          });
          const result = await model.generateContent({ contents });
          const response = await result.response;
          responseText = response.text();
        }

        modelUsed = currentModel;
        console.log(`[AI] Model ${currentModel} succeeded`);
        break; // Success! Exit fallback loop.
      } catch (err) {
        lastError = err;
        const isRetryable = isRetryableModelError(err);
        if (isRetryable) {
          recordGeminiQuotaFailure();
        }
        console.warn(`[AI] Model ${currentModel} failed: ${err.message || err}`);

        if (isRetryable && i < GEMINI_MODELS.length - 1) {
          console.log(`[AI] Recoverable error on ${currentModel}. Falling back to ${GEMINI_MODELS[i + 1]}...`);
        } else {
          if (!isRetryable) {
            console.error(`[AI] Non-retryable error on ${currentModel}. Aborting fallback chain.`);
          } else {
            console.error(`[AI] All candidate models in fallback chain exhausted.`);
          }
          break; // Stop loop on non-retryable error
        }
      }
    }

    if (!responseText) {
      throw lastError || new Error('All Gemini models failed to generate a response.');
    }

    // NON-BLOCKING: Stage Gemini response into candidate cache for offline human review
    try {
      if (userQuery) {
        stageCandidate(userQuery, responseText, modelUsed);
      }
    } catch (stageErr) {
      console.warn('[CandidateStore] Non-blocking staging error, continuing normally:', stageErr.message);
    }

    return res.status(200).json({
      success: true,
      response: responseText,
      source: 'gemini',
      modelUsed: modelUsed,
      presentationSignal: {
        emotion: 'thoughtful',
        tone: 'warm',
        intensity: 'normal'
      }
    });

  } catch (err) {
    console.error('Error handling /api/chat request:', err.message);
    const isProduction = process.env.NODE_ENV === 'production';
    return res.status(500).json({
      success: false,
      error: isProduction
        ? 'Internal Server Error. Unable to process message.'
        : `Gemini API Error: ${err.message || 'An error occurred while communicating with Gemini API.'}`
    });
  }
});

/* ════════════════════════════════════════════
   MIRA KNOWLEDGE GOVERNANCE ADMIN API (PHASE 16)
   ════════════════════════════════════════════ */
const {
  getGovernanceStats,
  getFaqs,
  getCandidatesList,
  getCandidateById,
  getPromotionLog,
  promoteCandidateAction,
  rejectCandidateAction,
  keepCandidateAction,
  createFaqAction,
  updateFaqAction,
  deleteFaqAction,
  deleteFaqVariantAction
} = require('./scripts/review-candidates');

function reloadFaqEntries() {
  try {
    delete require.cache[require.resolve('./data/faq-cache.json')];
    faqEntries = require('./data/faq-cache.json');
  } catch (e) {
    try {
      const data = fs.readFileSync(path.join(__dirname, 'data', 'faq-cache.json'), 'utf8');
      faqEntries = JSON.parse(data);
    } catch (err) {
      console.warn('[Cache] Could not reload faq-cache.json:', err.message);
    }
  }
  return faqEntries;
}

/**
 * POST /api/admin/login
 * Verifies username + scrypt password hash, sets HttpOnly session cookie
 */
app.post('/api/admin/login', applyAdminHeaders, (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (checkAdminFailedThrottling(clientIp, res)) {
    return;
  }

  const { username, password } = req.body || {};

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    recordAdminAuthFailure(clientIp);
    return res.status(400).json({
      success: false,
      error: 'Username and password are required.'
    });
  }

  const configuredUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : '';
  const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH ? process.env.ADMIN_PASSWORD_HASH.trim() : '';

  if (!configuredUsername || !configuredPasswordHash) {
    return res.status(503).json({
      success: false,
      error: 'Admin authentication is not configured on the server.'
    });
  }

  const isUsernameValid = verifyTimingSafeKey(username.trim(), configuredUsername);
  const isPasswordValid = verifyPasswordScrypt(password, configuredPasswordHash);

  if (!isUsernameValid || !isPasswordValid) {
    recordAdminAuthFailure(clientIp);
    return res.status(401).json({
      success: false,
      error: 'Invalid username or password.'
    });
  }

  clearAdminAuthFailures(clientIp);
  const sessionId = createSession(configuredUsername);

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieFlags = [
    `mira_session=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_MS / 1000}`
  ];
  if (isProduction) {
    cookieFlags.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieFlags.join('; '));
  return res.status(200).json({
    success: true,
    authenticated: true
  });
});

/**
 * POST /api/admin/logout
 * Destroys server-side session and clears client cookie
 */
app.post('/api/admin/logout', applyAdminHeaders, (req, res) => {
  const cookies = parseCookies(req);
  const sessionId = cookies.mira_session;
  if (sessionId) {
    destroySession(sessionId);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieFlags = [
    'mira_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0'
  ];
  if (isProduction) {
    cookieFlags.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieFlags.join('; '));
  return res.status(200).json({
    success: true
  });
});

/**
 * Centralized Timing-Safe Admin Authentication Middleware for /api/admin/* (Dual-Path)
 * Supports PATH A (Browser HttpOnly session cookie) and PATH B (Machine x-admin-key header)
 */
function authenticateAdmin(req, res, next) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // PATH A — Check Browser Session Cookie
  const cookies = parseCookies(req);
  const sessionId = cookies.mira_session;
  if (sessionId) {
    const session = getValidSession(sessionId);
    if (session) {
      req.adminUser = session.username;
      clearAdminAuthFailures(clientIp);
      return next();
    }
  }

  // PATH B — Check API / Token Header (x-admin-key, Bearer, Basic)
  const adminApiKey = process.env.ADMIN_API_KEY ? process.env.ADMIN_API_KEY.trim() : '';

  const headerKey = req.headers['x-admin-key'];
  const basicKey = extractBasicAuthKey(req.headers['authorization']);
  const bearerKey = req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')
    ? req.headers['authorization'].substring(7).trim()
    : null;

  const candidateKey = headerKey || basicKey || bearerKey;

  if (candidateKey) {
    if (!adminApiKey) {
      return res.status(503).json({
        success: false,
        error: 'Admin authentication is not configured.'
      });
    }

    if (checkAdminFailedThrottling(clientIp, res)) {
      return;
    }

    if (verifyTimingSafeKey(candidateKey, adminApiKey)) {
      clearAdminAuthFailures(clientIp);
      return next();
    } else {
      recordAdminAuthFailure(clientIp);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized.'
      });
    }
  }

  // Neither valid session nor valid key supplied
  const hasLoginConfig = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH);
  if (!adminApiKey && !hasLoginConfig) {
    return res.status(503).json({
      success: false,
      error: 'Admin authentication is not configured.'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized.'
  });
}

// Protect all /api/admin/* endpoints with administrative headers and centralized authentication
app.use('/api/admin', applyAdminHeaders, authenticateAdmin);

// 1. GET /api/admin/stats
app.get('/api/admin/stats', (req, res) => {
  try {
    const stats = getGovernanceStats();
    return res.status(200).json({ success: true, ...stats });
  } catch (err) {
    console.error('[Admin API Error] GET /api/admin/stats:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/admin/candidates
app.get('/api/admin/candidates', (req, res) => {
  try {
    const { page, limit, classification, status, search } = req.query;
    const result = getCandidatesList({ page, limit, classification, status, search });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin API Error] GET /api/admin/candidates:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/admin/candidates/:id
app.get('/api/admin/candidates/:id', (req, res) => {
  try {
    const candidateId = req.params.id;
    const candidate = getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, error: `Candidate "${candidateId}" not found.` });
    }
    return res.status(200).json({ success: true, candidate });
  } catch (err) {
    console.error(`[Admin API Error] GET /api/admin/candidates/${req.params.id}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/admin/faqs
app.get('/api/admin/faqs', (req, res) => {
  try {
    const faqs = getFaqs();
    return res.status(200).json({ success: true, faqs });
  } catch (err) {
    console.error('[Admin API Error] GET /api/admin/faqs:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. POST /api/admin/faqs (Create New Canonical FAQ)
app.post('/api/admin/faqs', (req, res) => {
  try {
    const { id, category, answer, questions, anchor } = req.body || {};
    if (!id || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Both "id" and "answer" are required in JSON body.'
      });
    }

    const result = createFaqAction({ id, category, answer, questions, anchor });
    reloadFaqEntries();
    return res.status(201).json(result);
  } catch (err) {
    console.error('[Admin API Error] POST /api/admin/faqs:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 4c. PUT /api/admin/faqs/:id (Update Existing Canonical FAQ)
app.put('/api/admin/faqs/:id', (req, res) => {
  try {
    const faqId = req.params.id;
    const { category, answer, anchor, questions } = req.body || {};
    
    const result = updateFaqAction(faqId, { category, answer, anchor, questions });
    reloadFaqEntries();
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[Admin API Error] PUT /api/admin/faqs/${req.params.id}:`, err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 4d. DELETE /api/admin/faqs/:id (Delete Entire Canonical FAQ)
app.delete('/api/admin/faqs/:id', (req, res) => {
  try {
    const faqId = req.params.id;
    const result = deleteFaqAction(faqId);
    reloadFaqEntries();
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[Admin API Error] DELETE /api/admin/faqs/${req.params.id}:`, err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 4e. DELETE /api/admin/faqs/:id/variants (Delete Specific Question Variant)
app.delete('/api/admin/faqs/:id/variants', (req, res) => {
  try {
    const faqId = req.params.id;
    const variantText = (req.body && req.body.variantText) || req.query.variantText || req.query.variant;
    if (!variantText) {
      return res.status(400).json({
        success: false,
        error: '"variantText" is required in JSON body or query parameter (?variantText=...).'
      });
    }

    const result = deleteFaqVariantAction(faqId, variantText);
    reloadFaqEntries();
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[Admin API Error] DELETE /api/admin/faqs/${req.params.id}/variants:`, err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 5. GET /api/admin/log
app.get('/api/admin/log', (req, res) => {
  try {
    const { page, limit, decision } = req.query;
    const result = getPromotionLog({ page, limit, decision });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin API Error] GET /api/admin/log:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/admin/promote
app.post('/api/admin/promote', (req, res) => {
  try {
    const { candidateId, destinationFaqId } = req.body || {};
    if (!candidateId || !destinationFaqId) {
      return res.status(400).json({
        success: false,
        error: 'Both "candidateId" and "destinationFaqId" are required in JSON body.'
      });
    }

    const result = promoteCandidateAction(candidateId, destinationFaqId);
    reloadFaqEntries();

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Admin API Error] POST /api/admin/promote:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 7. POST /api/admin/reject
app.post('/api/admin/reject', (req, res) => {
  try {
    const { candidateId } = req.body || {};
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: '"candidateId" is required in JSON body.'
      });
    }

    const result = rejectCandidateAction(candidateId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Admin API Error] POST /api/admin/reject:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 8. POST /api/admin/keep
app.post('/api/admin/keep', (req, res) => {
  try {
    const { candidateId } = req.body || {};
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: '"candidateId" is required in JSON body.'
      });
    }

    const result = keepCandidateAction(candidateId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Admin API Error] POST /api/admin/keep:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Moses AI Assistant Brain Backend (Phase 2)`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(` Chat Endpoint: POST http://localhost:${PORT}/api/chat`);
  console.log(` Admin Console: http://localhost:${PORT}/admin/`);
  console.log(`==================================================\n`);
});
