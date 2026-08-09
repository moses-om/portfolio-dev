const express = require('express');
const cors = require('cors');
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
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
      const text = typeof m.content === 'string' ? m.content : (m.text || '');
      return {
        role: role,
        parts: [{ text: text }]
      };
    });
  } else if (typeof body.message === 'string' && body.message.trim() !== '') {
    return [{
      role: 'user',
      parts: [{ text: body.message.trim() }]
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
            modelUsed: null
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
              modelUsed: null
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
      modelUsed: modelUsed
    });

  } catch (err) {
    console.error('Error handling /api/chat request:', err.message);
    return res.status(500).json({
      success: false,
      error: `Gemini API Error: ${err.message || 'An error occurred while communicating with Gemini API.'}`
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

// Start Express server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` Moses AI Assistant Brain Backend (Phase 2)`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(` Chat Endpoint: POST http://localhost:${PORT}/api/chat`);
  console.log(`==================================================\n`);
});
