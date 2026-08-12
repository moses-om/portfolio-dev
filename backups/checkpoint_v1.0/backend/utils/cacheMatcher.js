/**
 * Zero-Cost Local FAQ Retrieval Engine (Phase 6C-2)
 * Pure native JavaScript implementation of normalization, tokenization,
 * and Jaccard token-set similarity matching against verified FAQ cache entries.
 */

const DEFAULT_THRESHOLD = 0.80;

// Common English stopwords to ignore in token overlap calculations
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'or', 'not', 'no', 'but', 'if', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'am', 'it', 'its', 'they', 'them',
  'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has', 'had'
]);

/**
 * Normalizes text: lowercases, trims, strips punctuation, and normalizes spaces.
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '') // Keep alphanumeric, spaces, single quotes, hyphens
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into an array of clean word tokens.
 * Optionally filters out common English stopwords.
 */
function tokenize(text, removeStopwords = true) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const rawTokens = normalized.split(/\s+/).filter(t => t.length > 0);
  if (!removeStopwords) return rawTokens;

  // Filter stopwords, but keep if query becomes empty
  const filtered = rawTokens.filter(t => !STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

/**
 * Calculates Jaccard Similarity between two token sets.
 * Jaccard = |Intersection| / |Union|
 */
function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA || !tokensB || tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...setA, ...setB]).size;
  if (unionCount === 0) return 0;

  return intersectionCount / unionCount;
}

/**
 * Searches an array of FAQ entries for the best similarity match against an incoming query.
 * Only entries with entry.verified === true are evaluated.
 */
function findBestFaqMatch(query, faqEntries, threshold = DEFAULT_THRESHOLD) {
  if (!query || !Array.isArray(faqEntries) || faqEntries.length === 0) {
    return {
      matched: false,
      score: 0,
      faqId: null,
      matchedQuestion: null,
      answer: null,
      anchor: null
    };
  }

  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return {
      matched: false,
      score: 0,
      faqId: null,
      matchedQuestion: null,
      answer: null,
      anchor: null
    };
  }

  let bestMatch = {
    matched: false,
    score: 0,
    faqId: null,
    matchedQuestion: null,
    answer: null,
    anchor: null
  };

  for (const entry of faqEntries) {
    // Safety Requirement: Ignore unverified entries
    if (!entry || entry.verified !== true) continue;
    if (!Array.isArray(entry.questions)) continue;

    for (const questionVariant of entry.questions) {
      const variantTokens = tokenize(questionVariant, true);
      const score = jaccardSimilarity(queryTokens, variantTokens);

      if (score > bestMatch.score) {
        bestMatch.score = score;
        bestMatch.faqId = entry.id;
        bestMatch.matchedQuestion = questionVariant;
        bestMatch.answer = entry.answer;
        bestMatch.anchor = entry.anchor || null;
      }
    }
  }

  // Apply configurable confidence threshold
  if (bestMatch.score >= threshold) {
    bestMatch.matched = true;
  } else {
    bestMatch.matched = false;
  }

  return bestMatch;
}

const CANDIDATE_THRESHOLD = 0.88;

/**
 * Searches an array of staged candidate entries for the best similarity match against an incoming query.
 * Only candidates with candidate.verified === false are evaluated in Layer 3.
 */
function findBestCandidateMatch(query, candidates, threshold = CANDIDATE_THRESHOLD) {
  if (!query || !Array.isArray(candidates) || candidates.length === 0) {
    return {
      matched: false,
      score: 0,
      candidate: null
    };
  }

  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return {
      matched: false,
      score: 0,
      candidate: null
    };
  }

  let bestCandidate = null;
  let bestScore = 0;

  for (const cand of candidates) {
    // Layer 3 rule: Only evaluate candidate entries (verified === false)
    if (!cand || cand.verified !== false) continue;

    const candTokens = Array.isArray(cand.normalizedQueryTokens) && cand.normalizedQueryTokens.length > 0
      ? cand.normalizedQueryTokens
      : tokenize(cand.originalQuery, true);

    const score = jaccardSimilarity(queryTokens, candTokens);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cand;
    }
  }

  if (bestScore >= threshold && bestCandidate) {
    return {
      matched: true,
      score: bestScore,
      candidate: bestCandidate
    };
  }

  return {
    matched: false,
    score: bestScore,
    candidate: null
  };
}

module.exports = {
  DEFAULT_THRESHOLD,
  CANDIDATE_THRESHOLD,
  normalizeText,
  tokenize,
  jaccardSimilarity,
  findBestFaqMatch,
  findBestCandidateMatch
};
