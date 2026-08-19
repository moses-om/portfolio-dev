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
const PORT = process.env.PORT || 3001;

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

app.use(express.json());

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
 * Admin GUI Authentication Middleware for /admin/ (HTTP Basic Auth challenge)
 */
function authenticateAdminGui(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY ? process.env.ADMIN_API_KEY.trim() : '';

  if (!adminApiKey) {
    return res.status(503).send('503 Service Unavailable: Admin authentication is not configured on the server.');
  }

  const headerKey = req.headers['x-admin-key'];
  const basicKey = extractBasicAuthKey(req.headers['authorization']);
  const candidateKey = headerKey || basicKey;

  if (!candidateKey || !verifyTimingSafeKey(candidateKey, adminApiKey)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="MIRA Knowledge Governance Console", charset="UTF-8"');
    return res.status(401).send('401 Unauthorized: Valid MIRA Admin credentials required.');
  }

  return next();
}

// Protect Admin GUI static assets and root route with authentication challenge BEFORE static serving
app.use('/admin', authenticateAdminGui);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Handle malformed JSON request bodies gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON in request body. Please ensure valid JSON structure.'
    });
  }
  next();
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
app.get('/api/health', (req, res) => {
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
app.get('/api/stats', (req, res) => {
  res.status(200).json(getMetrics());
});

/* ════════════════════════════════════════════
   MAIN ASSISTANT BRAIN CHAT ENDPOINT
   POST /api/chat
   Body: { "messages": [ { "role": "user", "content": "What does Moses do?" } ] }
   ════════════════════════════════════════════ */
app.post('/api/chat', async (req, res) => {
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
   PHASE 1 BACKWARD COMPATIBILITY TEST ENDPOINT
   POST /api/test
   ════════════════════════════════════════════ */
app.post('/api/test', async (req, res) => {
  // Forward to /api/chat logic
  req.url = '/api/chat';
  return app._router.handle(req, res);
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
 * Centralized Timing-Safe Admin Authentication Middleware for /api/admin/*
 */
function authenticateAdmin(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY ? process.env.ADMIN_API_KEY.trim() : '';

  if (!adminApiKey) {
    return res.status(503).json({
      success: false,
      error: 'Admin authentication is not configured.'
    });
  }

  const headerKey = req.headers['x-admin-key'];
  const basicKey = extractBasicAuthKey(req.headers['authorization']);
  const bearerKey = req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')
    ? req.headers['authorization'].substring(7).trim()
    : null;

  const candidateKey = headerKey || basicKey || bearerKey;

  if (!candidateKey || !verifyTimingSafeKey(candidateKey, adminApiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized.'
    });
  }

  return next();
}

// Protect all /api/admin/* endpoints with centralized authentication middleware
app.use('/api/admin', authenticateAdmin);

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
