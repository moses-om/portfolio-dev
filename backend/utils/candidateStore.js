/**
 * Zero-Cost Candidate Staging Store (Phase 6D-1)
 * Application-level knowledge accumulation pipeline.
 * Safely stages candidate Q&A pairs for human review with verified: false.
 */

const fs = require('fs');
const path = require('path');
const { tokenize, jaccardSimilarity } = require('./cacheMatcher');
const { recordCandidateStaged, recordCandidateRejected } = require('./metrics');

const CANDIDATE_CACHE_PATH = path.join(__dirname, '..', 'data', 'candidate-cache.json');
const CANDIDATE_SIMILARITY_THRESHOLD = 0.70;

// Injection & Command Patterns
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions/i,
  /remember\s+this/i,
  /store\s+this\s+as\s+fact/i,
  /change\s+your\s+knowledge/i,
  /update\s+your\s+database/i,
  /system\s+prompt/i,
  /you\s+are\s+now/i
];

// Secret / API Key Patterns
const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/,
  /sk-[A-Za-z0-9]{32,}/,
  /bearer\s+[A-Za-z0-9_-]{20,}/i,
  /api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /process\.env\./i
];

// Off-topic & Joke Patterns
const OFF_TOPIC_PATTERNS = [
  /\bjoke\b/i,
  /\briddle\b/i,
  /\bweather\b/i,
  /\brecipe\b/i,
  /\bpoem\b/i,
  /\bsong\b/i,
  /tell\s+me\s+a\s+story/i
];

// Known-Unknown / Ungrounded Prompt Patterns (do not stage as permanent answers)
const UNKNOWN_PROMPT_PATTERNS = [
  /\bsalary\b/i,
  /\bgpa\b/i,
  /favorite\s+(ice\s+cream|food|movie|color|song)/i,
  /will\s+moses\s+move/i,
  /why\s+did\s+moses\s+leave/i
];

/**
 * Loads current candidate entries from candidate-cache.json safely.
 */
function loadCandidates() {
  try {
    if (fs.existsSync(CANDIDATE_CACHE_PATH)) {
      const data = fs.readFileSync(CANDIDATE_CACHE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('[CandidateStore] Warning: Could not read candidate-cache.json:', err.message);
  }
  return [];
}

/**
 * Saves candidate entries to candidate-cache.json safely.
 */
function saveCandidates(candidates) {
  try {
    fs.writeFileSync(CANDIDATE_CACHE_PATH, JSON.stringify(candidates, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CandidateStore] Warning: Could not write to candidate-cache.json:', err.message);
  }
}

/**
 * Validates whether a query and Gemini response are safe for candidate staging.
 */
function validateCandidateSafety(query, responseText) {
  if (!query || typeof query !== 'string' || !responseText || typeof responseText !== 'string') {
    return { safe: false, reason: 'Empty query or response text' };
  }

  const cleanQuery = query.trim();
  const cleanResponse = responseText.trim();

  if (cleanQuery.length < 5 || cleanResponse.length < 10) {
    return { safe: false, reason: 'Query or response too short' };
  }

  // 1. Check for prompt injection
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(cleanQuery) || pat.test(cleanResponse)) {
      return { safe: false, reason: 'Prompt injection or system command detected' };
    }
  }

  // 2. Check for secrets / API key leaks
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(cleanQuery) || pat.test(cleanResponse)) {
      return { safe: false, reason: 'Potential secret or API key pattern detected' };
    }
  }

  // 3. Check for off-topic / jokes / casual conversation
  for (const pat of OFF_TOPIC_PATTERNS) {
    if (pat.test(cleanQuery)) {
      return { safe: false, reason: 'Off-topic or non-portfolio request' };
    }
  }

  // 4. Check for ungrounded / known-unknown questions
  for (const pat of UNKNOWN_PROMPT_PATTERNS) {
    if (pat.test(cleanQuery)) {
      return { safe: false, reason: 'Known-unknown or ungrounded question category' };
    }
  }

  return { safe: true };
}

/**
 * Stages a clean Gemini response into candidate-cache.json if safe.
 * Updates usage count if duplicate match is found.
 */
function stageCandidate(query, responseText, modelUsed = 'gemini-3.6-flash') {
  try {
    const validation = validateCandidateSafety(query, responseText);
    if (!validation.safe) {
      recordCandidateRejected();
      console.log(`[CandidateStore] Candidate rejected: ${validation.reason}`);
      return { staged: false, reason: validation.reason };
    }

    const candidates = loadCandidates();
    const queryTokens = tokenize(query, true);

    // Duplicate Check using Jaccard Similarity
    let duplicateIndex = -1;
    let highestScore = 0;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const candTokens = cand.normalizedQueryTokens || tokenize(cand.originalQuery, true);
      const score = jaccardSimilarity(queryTokens, candTokens);

      if (score >= CANDIDATE_SIMILARITY_THRESHOLD && score > highestScore) {
        highestScore = score;
        duplicateIndex = i;
      }
    }

    const now = new Date().toISOString();

    if (duplicateIndex !== -1) {
      // Update existing duplicate candidate without overriding verified flag or answer
      const cand = candidates[duplicateIndex];
      cand.usageCount = (cand.usageCount || 1) + 1;
      cand.lastUsedAt = now;
      cand.modelUsed = modelUsed;
      saveCandidates(candidates);
      recordCandidateStaged();
      console.log(`[CandidateStore] Candidate updated (usageCount: ${cand.usageCount}, id: ${cand.id})`);
      return { staged: true, action: 'updated', candidateId: cand.id };
    }

    // Create new candidate
    const newCandidate = {
      id: `candidate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: 'general',
      originalQuery: query.trim(),
      normalizedQueryTokens: queryTokens,
      answer: responseText.trim(),
      source: 'gemini-generated-candidate',
      modelUsed: modelUsed,
      confidenceScore: 0.85,
      verified: false, // CRITICAL: Always false
      usageCount: 1,
      createdAt: now,
      lastUsedAt: now,
      revalidationRequired: true
    };

    candidates.push(newCandidate);
    saveCandidates(candidates);
    recordCandidateStaged();
    console.log(`[CandidateStore] New candidate staged successfully (id: ${newCandidate.id})`);
    return { staged: true, action: 'created', candidateId: newCandidate.id };

  } catch (err) {
    console.warn('[CandidateStore] Non-blocking staging error:', err.message);
    return { staged: false, reason: err.message };
  }
}

module.exports = {
  loadCandidates,
  validateCandidateSafety,
  stageCandidate
};
