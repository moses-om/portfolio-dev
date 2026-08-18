/**
 * MIRA Candidate Verification & Provenance Workflow CLI (Phase 14 Hardened)
 * Offline candidate management tool. DOES NOT modify server or runtime orchestration.
 * 
 * Usage:
 *   node backend/scripts/review-candidates.js --stats
 *   node backend/scripts/review-candidates.js --list
 *   node backend/scripts/review-candidates.js --candidate <id>
 *   node backend/scripts/review-candidates.js --promote <id> --to <faq-id> [--dry-run]
 *   node backend/scripts/review-candidates.js --reject <id> [--dry-run]
 *   node backend/scripts/review-candidates.js --dry-run
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const CANDIDATES_PATH = path.join(DATA_DIR, 'candidate-cache.json');
const FAQ_PATH = path.join(DATA_DIR, 'faq-cache.json');
const LOG_PATH = path.join(DATA_DIR, 'candidate-promotion-log.json');

// Helper to load JSON
function loadJson(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`[Error] Failed to read/parse ${filePath}:`, e.message);
  }
  return fallback;
}

// Classification Helper (Phase 15 Semantic Robustness Hardened)
function classifyCandidate(candidate, faqEntries = []) {
  const ans = (candidate.answer || '').toLowerCase();
  const query = (candidate.originalQuery || '').toLowerCase().trim();
  const normQ = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. GUARDRAIL RESPONSES: Identity claims, fact injection/override attempts, authority claims, assertions
  const isGuardrailAnswer = (
    ans.includes('cannot verify the identity of the speaker') ||
    ans.includes('user-provided update') ||
    ans.includes('user-provided clarification') ||
    ans.includes('assuming your clarification is correct') ||
    ans.includes('cannot verify external authority') ||
    ans.includes('grounded in the verified portfolio') ||
    ans.includes('cannot overwrite verified portfolio')
  );

  const isInjectionOrOverrideQuery = (
    // Explicit injection / override keywords
    /\b(is now|are now|set .+ to|change .+ to|update .+ to|use my|ignore (the )?portfolio|from now on|remember that|remember:|system override|portfolio manager confirmed|override:|new latency|updated latency)\b/i.test(query) ||
    // Identity impersonation claims asserting authority
    /\b(i am|i'm|i am the|i'm the)\s+(moses|owner|portfolio owner|lead engineer|developer|administrator|admin|creator|author)\b/i.test(query) ||
    // Unverified declarative assertions attempting to alter facts without being questions
    /\b(moses has a phd|moses studied computer science|moses works at google|dpoe latency is now|dpoe = mira)\b/i.test(query)
  );

  if (isGuardrailAnswer || isInjectionOrOverrideQuery) {
    return 'GUARDRAIL_RESPONSE';
  }

  // 2. OUT-OF-SCOPE / PRIVACY: Personal, private, or unrelated queries
  const isOutOfScopeAnswer = (
    ans.includes('not publicly disclosed') ||
    ans.includes('favorite programming language') ||
    ans.includes('favorite football team') ||
    ans.includes('street address') ||
    ans.includes('personal phone number') ||
    ans.includes('favorite food') ||
    ans.includes("don't have information regarding moses's future") ||
    ans.includes('exact age and date of birth are not specified') ||
    ans.includes('personal life') ||
    ans.includes('home address')
  );

  const isOutOfScopeQuery = (
    /\b(home address|residential address|living address|personal phone|mobile number|phone number|favorite football|favorite team|favorite soccer|favorite food|favorite movie|how old is moses|moses'?s? age|date of birth|birth date|marital status|girlfriend|wife|family)\b/i.test(query)
  );

  if (isOutOfScopeAnswer || isOutOfScopeQuery) {
    return 'OUT_OF_SCOPE';
  }

  // 3. REQUIRES_REVIEW: Genuine subjective speculation, ungrounded career predictions, or ambiguous unevidenced claims
  const isUnsupportedOrSubjectiveQuery = (
    /\b(will moses (become|be)|is moses (one of )?(kenya's|the) best|is moses better than|who is better|what inspires moses|what is moses'?s? dream|can moses lead a team|salary expectation|how much does moses earn)\b/i.test(query)
  );

  if (isUnsupportedOrSubjectiveQuery) {
    return 'REQUIRES_REVIEW';
  }

  // 4. CANONICAL_SUPPORTED_SYNTHESIS: Multi-fact synthesis, cross-project analysis, connecting background disciplines
  const isSynthesisQuery = (
    /\b(connect|connection|connects|connecting|bridge|intersection|relationship|relate)\b/i.test(query) ||
    /\b(compare|comparison|versus|vs|difference between)\b/i.test(query) ||
    /\b(demonstrate|demonstrates|showcase|showcases|illustrate|illustrates|highlight|highlights)\b/i.test(query) ||
    /\b(theme|themes|pattern|patterns|common (technical )?themes|across (his )?(projects|work))\b/i.test(query) ||
    /\b(synthesis|synthesize|holistic|broader|lifecycle)\b/i.test(query) ||
    /\b(how do(es)? .+ (connect|demonstrate|translate|relate))\b/i.test(query) ||
    /\b(which projects (best|most) demonstrate|projects demonstrate)\b/i.test(query) ||
    /\b(strongest (technical )?capabilities|engineering ability|technical themes)\b/i.test(query)
  );

  if (isSynthesisQuery) {
    return 'CANONICAL_SUPPORTED_SYNTHESIS';
  }

  // 5. CANONICAL_DUPLICATE: Semantic equivalence to existing verified canonical knowledge domains
  // Canonical Domain Semantic Matchers
  const domainPatterns = [
    // BI & Power BI
    /\b(bi|business intelligence|power bi|dax|power bi service|dashboard|dashboards|data visualization|visualizations|analytics tools|bi platforms|bi tools)\b/i,
    // Education & Degrees
    /\b(education|degree|educational|academic|university|college|school|snhu|kepler|bachelor|graduated|studied|study|qualification)\b/i,
    // Data Engineering & SQL
    /\b(data engineering|etl|pipeline|pipelines|sql|mysql|database|databases|relational|rdbms|data modeling|data analysis skills|acquire data analysis|data analysis)\b/i,
    // Identity Overview
    /\b(who is moses|what does moses do|about moses|background|specialization|professional profile|career overview|professional focus)\b/i,
    // Ashesi Role & Experience
    /\b(current role|work at ashesi|consulting work|employment history|work experience|career history|roles|jobs|education collaborative)\b/i,
    // Research & Papers
    /\b(research|publications|papers|published|ssrn|researchgate|case studies|articles|intermodal transport)\b/i,
    // Virtual Simulations
    /\b(forage|virtual simulation|job simulation|pwc|deloitte|accenture|british airways|tata iq)\b/i,
    // Applied AI & Tech Stack
    /\b(applied ai|ai tools|frontier ai|machine learning|chatgpt|claude|gemini|prompt engineering|technical stack|tech stack|software tools|technical skillset)\b/i,
    // Ashesi Ranking Project
    /\b(ranking system|ranking dashboard|institutional ranking|ashesi ranking|kobotoolbox survey|kobo api)\b/i,
    // DPOE Architecture
    /\b(dpoe|orchestration engine|optimization engine|mira intelligence architecture|prompt optimization|latency|evaluation metrics|research architecture)\b/i,
    // EA Hub Project
    /\b(ea hub|east africa hub|excel rdbms|spss)\b/i,
    // ChatGPT Chat Porter
    /\b(chat porter|chatgpt porter|privacy export|export tool|browser local export)\b/i,
    // Contact Info
    /\b(contact|email|get in touch|reach moses|linkedin|github|hire moses|send message)\b/i
  ];

  const matchesAnyDomain = domainPatterns.some(pattern => pattern.test(normQ));

  // Also check lexical & token overlap with FAQ question variants
  const isFaqOverlap = (faqEntries || []).some(faq => {
    return (faq.questions || []).some(q => {
      const qNorm = q.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normQ.includes(qNorm) || qNorm.includes(normQ)) return true;

      // Token overlap with stopword removal
      const qTokens = qNorm.split(' ').filter(t => t.length > 2);
      const userTokens = normQ.split(' ').filter(t => t.length > 2);
      const common = qTokens.filter(t => userTokens.includes(t));
      return (common.length >= 2 && common.length / Math.min(qTokens.length, userTokens.length) >= 0.4);
    });
  });

  if (matchesAnyDomain || isFaqOverlap) {
    return 'CANONICAL_DUPLICATE';
  }

  // Fallback for genuinely novel, ungrounded, or ambiguous queries
  return 'REQUIRES_REVIEW';
}

// Atomic FAQ Update with Timestamped Backup
function saveFaqAtomic(updatedFaq, isDryRun = false) {
  if (isDryRun) {
    console.log('[Dry Run] Simulated atomic write to faq-cache.json (No files modified).');
    return true;
  }

  try {
    // 1. Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 2. Create timestamped backup of faq-cache.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `faq-cache.backup-${timestamp}.json`);
    if (fs.existsSync(FAQ_PATH)) {
      fs.copyFileSync(FAQ_PATH, backupPath);
      console.log(`[Backup Created] ${backupPath}`);
    }

    // 3. Write to temporary file
    const tmpPath = path.join(DATA_DIR, 'faq-cache.tmp.json');
    const jsonContent = JSON.stringify(updatedFaq, null, 2);
    fs.writeFileSync(tmpPath, jsonContent, 'utf8');

    // 4. Validate temporary JSON
    const reParsed = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    if (!Array.isArray(reParsed) || reParsed.length === 0) {
      throw new Error('Temporary FAQ JSON validation failed: Output is not a valid non-empty array.');
    }

    // 5. Replace original file atomically
    fs.renameSync(tmpPath, FAQ_PATH);
    console.log(`[Atomic Save Success] Updated ${FAQ_PATH}`);
    return true;
  } catch (err) {
    console.error(`[Atomic Save Failure] Rollback triggered: ${err.message}`);
    return false;
  }
}

// Append decision to promotion log
function logDecision(logEntry, isDryRun = false) {
  if (isDryRun) {
    console.log('[Dry Run] Simulated append to candidate-promotion-log.json:', logEntry);
    return;
  }

  const logData = loadJson(LOG_PATH, []);
  logData.push(logEntry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(logData, null, 2), 'utf8');
  console.log(`[Logged Decision] Saved entry to candidate-promotion-log.json`);
}

// Main CLI Logic
function runCli() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const promotionLog = loadJson(LOG_PATH, []);

  const classified = candidates.map(c => ({
    ...c,
    classification: classifyCandidate(c, faqEntries)
  }));

  if (args.includes('--stats') || args.length === 0 || (isDryRun && args.length === 1)) {
    console.log('\n===============================================================');
    console.log(' MIRA Candidate Verification & Provenance Workflow Stats ');
    console.log('===============================================================');
    console.log(`Total Candidates in Storage   : ${candidates.length}`);
    console.log(`Total Verified FAQ Entries    : ${faqEntries.length}`);
    console.log(`Total Logged Decisions        : ${promotionLog.length}`);
    console.log(`Automatically Promoted        : 0 (Strict Human Approval Required)`);
    console.log('\nClassification Breakdown:');

    const counts = {};
    classified.forEach(c => {
      counts[c.classification] = (counts[c.classification] || 0) + 1;
    });
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`  - ${type.padEnd(30)} : ${count}`);
    });

    const eligibleForReview = classified.filter(c => c.classification === 'CANONICAL_DUPLICATE' || c.classification === 'CANONICAL_SUPPORTED_SYNTHESIS').length;
    console.log(`\nCandidates Eligible for Review : ${eligibleForReview}`);
    console.log('===============================================================\n');
    return;
  }

  if (args.includes('--list')) {
    console.log('\n===============================================================');
    console.log(' Candidate Cache Review List ');
    console.log('===============================================================');
    classified.forEach((c, idx) => {
      console.log(`[${idx + 1}] ID: ${c.id}`);
      console.log(`    Query         : "${c.originalQuery}"`);
      console.log(`    Classification: ${c.classification}`);
      console.log(`    Score         : ${c.confidenceScore} | Model: ${c.modelUsed} | Verified: ${c.verified}`);
      console.log('---------------------------------------------------------------');
    });
    return;
  }

  const candidateIdx = args.indexOf('--candidate');
  if (candidateIdx !== -1 && args[candidateIdx + 1]) {
    const targetId = args[candidateIdx + 1];
    const candidate = classified.find(c => c.id === targetId);
    if (!candidate) {
      console.error(`[Error] Candidate ID "${targetId}" not found.`);
      return;
    }
    console.log('\n===============================================================');
    console.log(` Candidate Details: ${candidate.id} `);
    console.log('===============================================================');
    console.log(`Query         : "${candidate.originalQuery}"`);
    console.log(`Classification: ${candidate.classification}`);
    console.log(`Score         : ${candidate.confidenceScore}`);
    console.log(`Model Used    : ${candidate.modelUsed}`);
    console.log(`Verified      : ${candidate.verified}`);
    console.log(`Created At    : ${candidate.createdAt}`);
    console.log(`\nAnswer Content:\n${candidate.answer}`);
    console.log('===============================================================\n');
    return;
  }

  const promoteIdx = args.indexOf('--promote');
  if (promoteIdx !== -1 && args[promoteIdx + 1]) {
    const targetId = args[promoteIdx + 1];
    const candidate = classified.find(c => c.id === targetId);
    if (!candidate) {
      console.error(`[Promotion Error] Candidate ID "${targetId}" not found.`);
      return;
    }

    if (candidate.classification === 'GUARDRAIL_RESPONSE' || candidate.classification === 'OUT_OF_SCOPE') {
      console.error(`[Promotion Safety Error] Cannot promote candidate "${targetId}" classified as ${candidate.classification}.`);
      return;
    }

    // Explicit Destination Enforcement (No silent fallback permitted)
    const toIdx = args.indexOf('--to');
    let targetFaq = null;

    if (toIdx !== -1 && args[toIdx + 1]) {
      const explicitFaqId = args[toIdx + 1];
      targetFaq = faqEntries.find(f => f.id === explicitFaqId);
      if (!targetFaq) {
        console.error(`[Promotion Safety Error] Specified destination FAQ ID "${explicitFaqId}" does not exist in faq-cache.json.`);
        return;
      }
    } else {
      // Try exact query match across existing FAQ entries
      targetFaq = faqEntries.find(f => f.questions.some(q => q.toLowerCase() === candidate.originalQuery.toLowerCase()));
      if (!targetFaq) {
        console.error(`[Promotion Safety Error] Promotion requires an explicit destination FAQ ID via --to <faq-id>. Silent fallback is disabled.`);
        return;
      }
    }

    console.log(`\n[Promoting Candidate] ID: ${candidate.id}`);
    console.log(`Query: "${candidate.originalQuery}"`);
    console.log(`Destination FAQ ID: ${targetFaq.id}`);

    if (!targetFaq.questions.includes(candidate.originalQuery)) {
      targetFaq.questions.push(candidate.originalQuery);
    } else {
      console.log(`[Notice] Query variant already exists in FAQ "${targetFaq.id}".`);
    }

    const success = saveFaqAtomic(faqEntries, isDryRun);
    if (success) {
      logDecision({
        candidateId: candidate.id,
        originalQuery: candidate.originalQuery,
        classification: candidate.classification,
        decision: 'PROMOTED',
        reviewerDecisionTimestamp: new Date().toISOString(),
        destinationFaqId: targetFaq.id,
        originalProvenance: candidate.source || 'gemini-generated-candidate'
      }, isDryRun);
      console.log(`[Promotion Complete] Candidate ${candidate.id} promoted successfully to "${targetFaq.id}".`);
    }
    return;
  }

  const rejectIdx = args.indexOf('--reject');
  if (rejectIdx !== -1 && args[rejectIdx + 1]) {
    const targetId = args[rejectIdx + 1];
    const candidate = classified.find(c => c.id === targetId);
    if (!candidate) {
      console.error(`[Error] Candidate ID "${targetId}" not found.`);
      return;
    }

    logDecision({
      candidateId: candidate.id,
      originalQuery: candidate.originalQuery,
      classification: candidate.classification,
      decision: 'REJECTED',
      reviewerDecisionTimestamp: new Date().toISOString(),
      destinationFaqId: null,
      originalProvenance: candidate.source || 'gemini-generated-candidate'
    }, isDryRun);
    console.log(`[Rejection Complete] Candidate ${candidate.id} rejected.`);
    return;
  }
}

// ════════════════════════════════════════════
// GOVERNANCE SERVICE LAYER FOR ADMIN API & GUI
// ════════════════════════════════════════════

function getGovernanceStats() {
  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const promotionLog = loadJson(LOG_PATH, []);

  let questionVariantsCount = 0;
  faqEntries.forEach(f => {
    questionVariantsCount += (f.questions || []).length;
  });

  const classificationCounts = {
    CANONICAL_DUPLICATE: 0,
    CANONICAL_SUPPORTED_SYNTHESIS: 0,
    REQUIRES_REVIEW: 0,
    GUARDRAIL_RESPONSE: 0,
    OUT_OF_SCOPE: 0
  };

  const statusCounts = {
    PENDING: 0,
    PROMOTED: 0,
    REJECTED: 0,
    KEEP_FOR_REVIEW: 0
  };

  const decisionMap = new Map();
  promotionLog.forEach(entry => {
    if (entry.candidateId) {
      decisionMap.set(entry.candidateId, entry.decision);
    }
  });

  let eligibleCount = 0;

  candidates.forEach(c => {
    const cls = classifyCandidate(c, faqEntries);
    classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;

    const status = decisionMap.get(c.id) || 'PENDING';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if ((cls === 'CANONICAL_DUPLICATE' || cls === 'CANONICAL_SUPPORTED_SYNTHESIS') && status === 'PENDING') {
      eligibleCount++;
    }
  });

  return {
    totalCandidates: candidates.length,
    totalVerifiedFaqs: faqEntries.length,
    totalQuestionVariants: questionVariantsCount,
    totalLoggedDecisions: promotionLog.length,
    eligibleForReview: eligibleCount,
    classificationBreakdown: classificationCounts,
    statusBreakdown: statusCounts
  };
}

function getFaqs() {
  return loadJson(FAQ_PATH, []);
}

function getCandidateGovernanceMetadata(candidate, faqEntries = []) {
  const query = (candidate.originalQuery || '').trim();
  const qLower = query.toLowerCase();
  const cls = classifyCandidate(candidate, faqEntries);

  let bestFaq = null;
  for (const faq of faqEntries) {
    if ((faq.questions || []).some(q => q.toLowerCase() === qLower)) {
      bestFaq = faq;
      break;
    }
  }

  if (!bestFaq) {
    if (/\b(data engineering|etl|sql|database|databases|python|rdbms|data modeling|data analysis)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'data-engineering-sql');
    } else if (/\b(education|degree|educational|academic|university|college|school|snhu|kepler|bachelor|graduated|studied)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'educational-background');
    } else if (/\b(power bi|bi tools|business intelligence|dax|dashboard|dashboards|power bi service)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'power-bi-experience');
    } else if (/\b(ranking system|ranking dashboard|institutional ranking|ashesi ranking|kobo)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'ashesi-ranking-project');
    } else if (/\b(dpoe|mira|orchestration engine|optimization engine|latency|evaluation metrics)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'dpoe-research-architecture');
    } else if (/\b(ea hub|east africa hub|excel rdbms|spss)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'ea-hub-project');
    } else if (/\b(chat porter|chatgpt porter|privacy export)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'chatgpt-chat-porter');
    } else if (/\b(research|publications|papers|published|ssrn|researchgate)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'research-publications');
    } else if (/\b(forage|simulation|pwc|deloitte|accenture)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'forage-virtual-simulations');
    } else if (/\b(applied ai|ai tools|machine learning|frontier ai|tech stack|tools)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'applied-ai-toolstack');
    } else if (/\b(current role|work at ashesi|consulting work|work experience|employment history)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'ashesi-work-experience');
    } else if (/\b(contact|email|reach moses|linkedin|github)\b/i.test(qLower)) {
      bestFaq = faqEntries.find(f => f.id === 'contact-information');
    } else {
      bestFaq = faqEntries.find(f => f.id === 'identity-overview');
    }
  }

  let queryNature = 'factual information request';
  if (cls === 'GUARDRAIL_RESPONSE') {
    if (/\b(i am|i'm|as moses|owner|admin)\b/i.test(qLower)) queryNature = 'identity assertion';
    else if (/\b(is now|change .+ to|update .+ to|ignore)\b/i.test(qLower)) queryNature = 'fact override';
    else queryNature = 'prompt injection';
  } else if (cls === 'OUT_OF_SCOPE') {
    queryNature = 'out of scope request';
  } else if (cls === 'CANONICAL_SUPPORTED_SYNTHESIS') {
    queryNature = 'grounded synthesis';
  } else if (/\b(open|navigate|link|browse|read)\b/i.test(qLower)) {
    queryNature = 'navigation request';
  } else if (/\b(what if|under that assumption|now forget|by bi i mean)\b/i.test(qLower)) {
    queryNature = 'conversational/meta dialogue';
  } else if (/\b(how did moses build|what methods|workflow|analytical process)\b/i.test(qLower)) {
    queryNature = 'methodological/process question';
  } else if (/\b(will moses|is moses the best|could moses)\b/i.test(qLower)) {
    queryNature = 'hypothetical/inference';
  } else {
    queryNature = 'semantic paraphrase';
  }

  let recommendation = 'KEEP FOR REVIEW';
  let reason = 'Candidate requires human review and validation.';
  let destinationFaqId = bestFaq ? bestFaq.id : null;

  if (cls === 'GUARDRAIL_RESPONSE') {
    recommendation = 'REJECT';
    reason = 'Contains identity claim, unverified assertion, or prompt injection.';
    destinationFaqId = null;
  } else if (cls === 'OUT_OF_SCOPE') {
    recommendation = 'REJECT';
    reason = 'Non-professional or private data request outside verified portfolio scope.';
    destinationFaqId = null;
  } else if (queryNature === 'conversational/meta dialogue' || queryNature === 'navigation request' || query.length < 10) {
    recommendation = 'REJECT';
    reason = 'Conversational testing artifact or external tool execution command.';
    destinationFaqId = null;
  } else if (cls === 'CANONICAL_DUPLICATE' && bestFaq) {
    recommendation = 'PROMOTE';
    reason = `Reusable natural-language variant grounded in canonical ${bestFaq.id} facts.`;
  } else if (cls === 'CANONICAL_SUPPORTED_SYNTHESIS') {
    recommendation = 'KEEP FOR REVIEW';
    reason = 'Cross-project synthesis query; best evaluated for dynamic multi-fact orchestration.';
  } else {
    recommendation = 'KEEP FOR REVIEW';
    reason = 'Unevidenced or novel query requiring reviewer determination.';
  }

  return {
    classification: cls,
    matchedFaq: bestFaq ? {
      id: bestFaq.id,
      category: bestFaq.category,
      questions: bestFaq.questions || [],
      answer: bestFaq.answer,
      source: bestFaq.source
    } : null,
    groundingEvidence: bestFaq ? bestFaq.source : 'portfolio.identity / portfolio.skills',
    queryNature,
    recommendation,
    reason,
    destinationFaqId
  };
}

function getCandidatesList(options = {}) {
  const {
    page = 1,
    limit = 50,
    classification = null,
    status = null,
    search = ''
  } = options;

  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const promotionLog = loadJson(LOG_PATH, []);

  const decisionMap = new Map();
  promotionLog.forEach(entry => {
    if (entry.candidateId) {
      decisionMap.set(entry.candidateId, entry.decision);
    }
  });

  let enriched = candidates.map(c => {
    const meta = getCandidateGovernanceMetadata(c, faqEntries);
    const candidateStatus = decisionMap.get(c.id) || 'PENDING';
    return {
      id: c.id,
      originalQuery: c.originalQuery,
      answer: c.answer,
      category: c.category || 'general',
      confidenceScore: c.confidenceScore || 0.85,
      modelUsed: c.modelUsed || 'gemini-3.6-flash',
      verified: Boolean(c.verified),
      source: c.source || 'gemini-generated-candidate',
      usageCount: c.usageCount || 1,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      classification: meta.classification,
      status: candidateStatus,
      destinationFaqId: meta.destinationFaqId,
      recommendation: meta.recommendation,
      queryNature: meta.queryNature,
      reason: meta.reason,
      matchedFaqId: meta.matchedFaq ? meta.matchedFaq.id : null
    };
  });

  if (classification && classification !== 'ALL') {
    if (classification === 'ELIGIBLE') {
      enriched = enriched.filter(c => c.classification === 'CANONICAL_DUPLICATE' || c.classification === 'CANONICAL_SUPPORTED_SYNTHESIS');
    } else {
      enriched = enriched.filter(c => c.classification === classification);
    }
  }

  if (status && status !== 'ALL') {
    enriched = enriched.filter(c => c.status === status);
  }

  if (search && search.trim()) {
    const rawSearch = search.trim().toLowerCase();
    const terms = rawSearch.split(/\s+/).filter(Boolean);

    // 1. Filter items that contain all search terms across ID, Question, or Answer
    enriched = enriched.filter(c => {
      const q = String(c.originalQuery || '').toLowerCase();
      const a = String(c.answer || '').toLowerCase();
      const id = String(c.id || '').toLowerCase();
      const combined = `${id} ${q} ${a}`;
      return terms.every(t => combined.includes(t));
    });

    // 2. Score items so ID and Question (query) matches strictly rank ahead of answer-only matches
    enriched.sort((a, b) => {
      const qA = String(a.originalQuery || '').toLowerCase();
      const idA = String(a.id || '').toLowerCase();
      const ansA = String(a.answer || '').toLowerCase();

      const qB = String(b.originalQuery || '').toLowerCase();
      const idB = String(b.id || '').toLowerCase();
      const ansB = String(b.answer || '').toLowerCase();

      // Check ID match score
      const idMatchA = idA.includes(rawSearch) ? 200 : (terms.every(t => idA.includes(t)) ? 150 : 0);
      const idMatchB = idB.includes(rawSearch) ? 200 : (terms.every(t => idB.includes(t)) ? 150 : 0);

      // Check Question match score
      const qMatchA = qA.includes(rawSearch) ? 100 : (terms.every(t => qA.includes(t)) ? 80 : 0);
      const qMatchB = qB.includes(rawSearch) ? 100 : (terms.every(t => qB.includes(t)) ? 80 : 0);

      // Answer match score
      const ansMatchA = ansA.includes(rawSearch) ? 20 : (terms.every(t => ansA.includes(t)) ? 10 : 0);
      const ansMatchB = ansB.includes(rawSearch) ? 20 : (terms.every(t => ansB.includes(t)) ? 10 : 0);

      const scoreA = idMatchA + qMatchA + ansMatchA;
      const scoreB = idMatchB + qMatchB + ansMatchB;

      return scoreB - scoreA;
    });
  }

  const total = enriched.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = enriched.slice(startIndex, startIndex + limitNum);

  return {
    candidates: paginated,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
}

function getCandidateById(candidateId) {
  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const promotionLog = loadJson(LOG_PATH, []);

  const candidate = candidates.find(c => c.id === candidateId);
  if (!candidate) return null;

  const meta = getCandidateGovernanceMetadata(candidate, faqEntries);
  const history = promotionLog.filter(l => l.candidateId === candidateId);
  const latestDecision = history.length > 0 ? history[history.length - 1].decision : 'PENDING';

  return {
    ...candidate,
    classification: meta.classification,
    status: latestDecision,
    matchedFaq: meta.matchedFaq,
    groundingEvidence: meta.groundingEvidence,
    queryNature: meta.queryNature,
    recommendation: meta.recommendation,
    reason: meta.reason,
    destinationFaqId: meta.destinationFaqId,
    auditHistory: history
  };
}

function getPromotionLog(options = {}) {
  const { page = 1, limit = 50, decision = null } = options;
  let log = loadJson(LOG_PATH, []);

  if (decision && decision !== 'ALL') {
    log = log.filter(entry => entry.decision === decision);
  }

  const reversed = [...log].reverse();
  const total = reversed.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = reversed.slice(startIndex, startIndex + limitNum);

  return {
    logs: paginated,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
}

function promoteCandidateAction(candidateId, destinationFaqId) {
  if (!candidateId || !destinationFaqId) {
    throw new Error('Both candidateId and destinationFaqId are required.');
  }

  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const candidate = candidates.find(c => c.id === candidateId);

  if (!candidate) {
    throw new Error(`Candidate "${candidateId}" not found.`);
  }

  const cls = classifyCandidate(candidate, faqEntries);
  if (cls === 'GUARDRAIL_RESPONSE' || cls === 'OUT_OF_SCOPE') {
    throw new Error(`Cannot promote candidate "${candidateId}" classified as ${cls}.`);
  }

  const targetFaq = faqEntries.find(f => f.id === destinationFaqId);
  if (!targetFaq) {
    throw new Error(`Destination FAQ "${destinationFaqId}" does not exist.`);
  }

  let variantAdded = false;
  if (!targetFaq.questions.includes(candidate.originalQuery)) {
    targetFaq.questions.push(candidate.originalQuery);
    variantAdded = true;
  }

  const success = saveFaqAtomic(faqEntries, false);
  if (!success) {
    throw new Error('Atomic write to faq-cache.json failed.');
  }

  const logEntry = {
    candidateId: candidate.id,
    originalQuery: candidate.originalQuery,
    classification: cls,
    decision: 'PROMOTED',
    reviewerDecisionTimestamp: new Date().toISOString(),
    destinationFaqId: targetFaq.id,
    originalProvenance: candidate.source || 'gemini-generated-candidate'
  };

  logDecision(logEntry, false);

  return {
    success: true,
    candidateId: candidate.id,
    destinationFaqId: targetFaq.id,
    variantAdded,
    logEntry
  };
}

function rejectCandidateAction(candidateId) {
  if (!candidateId) throw new Error('candidateId is required.');

  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const candidate = candidates.find(c => c.id === candidateId);

  if (!candidate) {
    throw new Error(`Candidate "${candidateId}" not found.`);
  }

  const cls = classifyCandidate(candidate, faqEntries);
  const logEntry = {
    candidateId: candidate.id,
    originalQuery: candidate.originalQuery,
    classification: cls,
    decision: 'REJECTED',
    reviewerDecisionTimestamp: new Date().toISOString(),
    destinationFaqId: null,
    originalProvenance: candidate.source || 'gemini-generated-candidate'
  };

  logDecision(logEntry, false);

  return {
    success: true,
    candidateId: candidate.id,
    decision: 'REJECTED',
    logEntry
  };
}

function keepCandidateAction(candidateId) {
  if (!candidateId) throw new Error('candidateId is required.');

  const candidates = loadJson(CANDIDATES_PATH, []);
  const faqEntries = loadJson(FAQ_PATH, []);
  const candidate = candidates.find(c => c.id === candidateId);

  if (!candidate) {
    throw new Error(`Candidate "${candidateId}" not found.`);
  }

  const cls = classifyCandidate(candidate, faqEntries);
  const logEntry = {
    candidateId: candidate.id,
    originalQuery: candidate.originalQuery,
    classification: cls,
    decision: 'KEEP_FOR_REVIEW',
    reviewerDecisionTimestamp: new Date().toISOString(),
    destinationFaqId: null,
    originalProvenance: candidate.source || 'gemini-generated-candidate'
  };

  logDecision(logEntry, false);

  return {
    success: true,
    candidateId: candidate.id,
    decision: 'KEEP_FOR_REVIEW',
    logEntry
  };
}

/**
 * ══════════════════════════════════════════════════════════
 * CANONICAL FAQ REGISTRY CRUD ACTIONS (Phase 16 Interactive)
 * ══════════════════════════════════════════════════════════
 */

function createFaqAction({ id, category, answer, questions, anchor }) {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('FAQ ID is required and must be a valid string.');
  }
  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    throw new Error('FAQ Answer is required.');
  }

  const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const faqEntries = loadJson(FAQ_PATH, []);

  if (faqEntries.some(f => f.id === cleanId)) {
    throw new Error(`An FAQ entry with ID "${cleanId}" already exists.`);
  }

  const qArray = Array.isArray(questions)
    ? questions.map(q => String(q).trim()).filter(Boolean)
    : (typeof questions === 'string' ? questions.split('\n').map(q => q.trim()).filter(Boolean) : []);

  if (qArray.length === 0) {
    qArray.push(cleanId.replace(/_/g, ' '));
  }

  const newFaq = {
    id: cleanId,
    category: (category && typeof category === 'string' && category.trim()) ? category.trim() : 'General',
    anchor: (anchor && typeof anchor === 'string' && anchor.trim()) ? anchor.trim() : '',
    answer: answer.trim(),
    questions: qArray
  };

  faqEntries.push(newFaq);
  const saved = saveFaqAtomic(faqEntries);
  if (!saved) {
    throw new Error('Failed to save new FAQ atomically to disk.');
  }

  return {
    success: true,
    action: 'CREATED',
    faq: newFaq
  };
}

function updateFaqAction(id, { category, answer, anchor, questions }) {
  if (!id) throw new Error('FAQ ID is required.');

  const faqEntries = loadJson(FAQ_PATH, []);
  const faqIndex = faqEntries.findIndex(f => f.id === id);

  if (faqIndex === -1) {
    throw new Error(`FAQ entry with ID "${id}" not found.`);
  }

  const target = faqEntries[faqIndex];

  if (category !== undefined && typeof category === 'string') {
    target.category = category.trim() || target.category;
  }
  if (answer !== undefined && typeof answer === 'string' && answer.trim()) {
    target.answer = answer.trim();
  }
  if (anchor !== undefined && typeof anchor === 'string') {
    target.anchor = anchor.trim();
  }
  if (questions !== undefined) {
    const qArray = Array.isArray(questions)
      ? questions.map(q => String(q).trim()).filter(Boolean)
      : (typeof questions === 'string' ? questions.split('\n').map(q => q.trim()).filter(Boolean) : target.questions);
    if (qArray.length > 0) {
      target.questions = qArray;
    }
  }

  const saved = saveFaqAtomic(faqEntries);
  if (!saved) {
    throw new Error('Failed to save updated FAQ atomically to disk.');
  }

  return {
    success: true,
    action: 'UPDATED',
    faq: target
  };
}

function deleteFaqAction(id) {
  if (!id) throw new Error('FAQ ID is required.');

  const faqEntries = loadJson(FAQ_PATH, []);
  const faqIndex = faqEntries.findIndex(f => f.id === id);

  if (faqIndex === -1) {
    throw new Error(`FAQ entry with ID "${id}" not found.`);
  }

  const deleted = faqEntries.splice(faqIndex, 1)[0];
  const saved = saveFaqAtomic(faqEntries);
  if (!saved) {
    throw new Error('Failed to persist FAQ deletion to disk.');
  }

  return {
    success: true,
    action: 'DELETED',
    deletedFaqId: id,
    deleted
  };
}

function deleteFaqVariantAction(id, variantText) {
  if (!id || !variantText) {
    throw new Error('Both FAQ ID and variantText are required.');
  }

  const faqEntries = loadJson(FAQ_PATH, []);
  const target = faqEntries.find(f => f.id === id);

  if (!target) {
    throw new Error(`FAQ entry with ID "${id}" not found.`);
  }

  const cleanVariant = String(variantText).trim().toLowerCase();
  const initialCount = target.questions.length;
  target.questions = (target.questions || []).filter(q => q.trim().toLowerCase() !== cleanVariant);

  if (target.questions.length === initialCount) {
    throw new Error(`Variant "${variantText}" was not found in FAQ "${id}".`);
  }

  const saved = saveFaqAtomic(faqEntries);
  if (!saved) {
    throw new Error('Failed to persist variant deletion to disk.');
  }

  return {
    success: true,
    action: 'VARIANT_DELETED',
    faqId: id,
    remainingVariantsCount: target.questions.length
  };
}

if (require.main === module) {
  runCli();
}

module.exports = {
  classifyCandidate,
  loadJson,
  saveFaqAtomic,
  logDecision,
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
  deleteFaqVariantAction,
  getCandidateGovernanceMetadata
};

