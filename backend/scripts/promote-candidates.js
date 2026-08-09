/**
 * Developer CLI Tool: Candidate Promotion & Human Review System (Phase 6D-3)
 * Allows developers to list, inspect, and manually promote candidate entries
 * from backend/data/candidate-cache.json to backend/data/faq-cache.json.
 * 
 * Usage:
 *   node backend/scripts/promote-candidates.js list
 *   node backend/scripts/promote-candidates.js show <candidate-id>
 *   node backend/scripts/promote-candidates.js promote <candidate-id>
 */

const fs = require('fs');
const path = require('path');
const { validateCandidateSafety, loadCandidates } = require('../utils/candidateStore');
const { findBestFaqMatch } = require('../utils/cacheMatcher');

const CANDIDATE_CACHE_PATH = path.join(__dirname, '..', 'data', 'candidate-cache.json');
const FAQ_CACHE_PATH = path.join(__dirname, '..', 'data', 'faq-cache.json');

const MIN_USAGE_COUNT = 5;
const MIN_CONFIDENCE_SCORE = 0.88;

function loadFaqs() {
  try {
    if (fs.existsSync(FAQ_CACHE_PATH)) {
      const data = fs.readFileSync(FAQ_CACHE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('[CLI Error] Could not load faq-cache.json:', err.message);
  }
  return [];
}

function saveFaqs(faqs) {
  fs.writeFileSync(FAQ_CACHE_PATH, JSON.stringify(faqs, null, 2), 'utf8');
}

function saveCandidates(candidates) {
  fs.writeFileSync(CANDIDATE_CACHE_PATH, JSON.stringify(candidates, null, 2), 'utf8');
}

function listCandidates() {
  const candidates = loadCandidates();
  console.log('==================================================');
  console.log(' STAGED CANDIDATES LIST');
  console.log(` Total Candidates: ${candidates.length}`);
  console.log('==================================================\n');

  if (candidates.length === 0) {
    console.log('No candidate entries found.');
    return;
  }

  candidates.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c.id}`);
    console.log(`    Original Query: "${c.originalQuery}"`);
    console.log(`    Answer: "${c.answer.substring(0, 80)}..."`);
    console.log(`    Status: Verified=${c.verified} | Promoted=${Boolean(c.promoted)} | UsageCount=${c.usageCount || 1} | Confidence=${c.confidenceScore}`);
    console.log(`    Model: ${c.modelUsed} | Created: ${c.createdAt} | Last Used: ${c.lastUsedAt}`);
    console.log('--------------------------------------------------');
  });
}

function showCandidate(candidateId) {
  if (!candidateId) {
    console.error('[CLI Error] Please provide a candidate ID.');
    process.exit(1);
  }

  const candidates = loadCandidates();
  const candidate = candidates.find(c => c.id === candidateId);

  if (!candidate) {
    console.error(`[CLI Error] Candidate ID "${candidateId}" not found.`);
    process.exit(1);
  }

  console.log('==================================================');
  console.log(` CANDIDATE DETAILS: ${candidate.id}`);
  console.log('==================================================');
  console.log(JSON.stringify(candidate, null, 2));
}

function promoteCandidate(candidateId) {
  if (!candidateId) {
    console.error('[CLI Error] Please provide a candidate ID to promote.');
    return { success: false, reason: 'Missing candidate ID' };
  }

  const candidates = loadCandidates();
  const candidateIndex = candidates.findIndex(c => c.id === candidateId);

  if (candidateIndex === -1) {
    const reason = `Candidate ID "${candidateId}" not found.`;
    console.error(`[CLI Error] ${reason}`);
    return { success: false, reason };
  }

  const candidate = candidates[candidateIndex];

  // 1. Check if already promoted
  if (candidate.promoted === true) {
    const reason = `candidate already promoted (promotedAt: ${candidate.promotedAt})`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 2. Check verified status
  if (candidate.verified !== false) {
    const reason = `candidate already verified or malformed verified flag`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 3. Check answer non-empty
  if (!candidate.answer || typeof candidate.answer !== 'string' || candidate.answer.trim().length === 0) {
    const reason = `candidate has invalid or empty answer`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 4. Check usage count threshold
  if ((candidate.usageCount || 1) < MIN_USAGE_COUNT) {
    const reason = `usageCount < ${MIN_USAGE_COUNT} (current usageCount: ${candidate.usageCount || 1})`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 5. Check confidence score threshold
  if ((candidate.confidenceScore || 0) < MIN_CONFIDENCE_SCORE) {
    const reason = `confidenceScore < ${MIN_CONFIDENCE_SCORE} (current score: ${candidate.confidenceScore || 0})`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 6. Run candidate safety validation
  const validation = validateCandidateSafety(candidate.originalQuery, candidate.answer);
  if (!validation.safe) {
    const reason = `validation failed (${validation.reason})`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 7. Check if semantically similar verified FAQ already exists
  const faqs = loadFaqs();
  const faqMatch = findBestFaqMatch(candidate.originalQuery, faqs, 0.80);

  if (faqMatch.matched) {
    const reason = `similar verified FAQ already exists (Matched ID: "${faqMatch.faqId}", Score: ${faqMatch.score.toFixed(4)})`;
    console.error(`[CLI Error] Promotion rejected: ${reason}`);
    return { success: false, reason };
  }

  // 8. Construct new verified FAQ entry
  const newFaqEntry = {
    id: `faq_promoted_${candidate.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    category: candidate.category || "general",
    questions: [ candidate.originalQuery ],
    answer: candidate.answer,
    source: `promoted-from-candidate:${candidate.id}`,
    anchor: "#projects",
    verified: true
  };

  // 9. Append to faq-cache.json
  faqs.push(newFaqEntry);
  saveFaqs(faqs);

  // 10. Update candidate record to preserve audit trail
  candidate.promoted = true;
  candidate.promotedAt = new Date().toISOString();
  candidate.promotedTo = "faq-cache.json";
  saveCandidates(candidates);

  console.log('==================================================');
  console.log(` SUCCESS: Candidate "${candidate.id}" promoted to FAQ Cache!`);
  console.log(` Promoted FAQ ID: "${newFaqEntry.id}"`);
  console.log('==================================================');

  return { success: true, faqId: newFaqEntry.id };
}

// CLI Execution Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetId = args[1];

  switch (command) {
    case 'list':
      listCandidates();
      break;
    case 'show':
      showCandidate(targetId);
      break;
    case 'promote':
      promoteCandidate(targetId);
      break;
    default:
      console.log('Usage:');
      console.log('  node backend/scripts/promote-candidates.js list');
      console.log('  node backend/scripts/promote-candidates.js show <candidate-id>');
      console.log('  node backend/scripts/promote-candidates.js promote <candidate-id>');
      break;
  }
}

module.exports = {
  listCandidates,
  showCandidate,
  promoteCandidate,
  MIN_USAGE_COUNT,
  MIN_CONFIDENCE_SCORE
};
