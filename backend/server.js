const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getSystemInstruction } = require('./prompts/system');

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
   MAIN ASSISTANT BRAIN CHAT ENDPOINT
   POST /api/chat
   Body: { "messages": [ { "role": "user", "content": "What does Moses do?" } ] }
   ════════════════════════════════════════════ */
app.post('/api/chat', async (req, res) => {
  try {
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

    if (sdkInstance.type === 'genai') {
      // Official @google/genai SDK call
      const ai = sdkInstance.client;
      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
        systemInstruction: systemInstruction
      });
      const result = await model.generateContent({ contents });
      const response = await result.response;
      responseText = response.text();
    }

    return res.status(200).json({
      success: true,
      response: responseText
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
