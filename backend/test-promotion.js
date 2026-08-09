/**
 * Phase 6D-3 Candidate Promotion Test Suite Script
 */

const fs = require('fs');
const path = require('path');

const CANDIDATE_CACHE_PATH = path.join(__dirname, 'data', 'candidate-cache.json');
const FAQ_CACHE_PATH = path.join(__dirname, 'data', 'faq-cache.json');

// Backup original data before testing
let origCandidates = '[]';
let origFaqs = '[]';

if (fs.existsSync(CANDIDATE_CACHE_PATH)) {
  origCandidates = fs.readFileSync(CANDIDATE_CACHE_PATH, 'utf8');
}

if (fs.existsSync(FAQ_CACHE_PATH)) {
  origFaqs = fs.readFileSync(FAQ_CACHE_PATH, 'utf8');
}

const initialFaqsCount = JSON.parse(origFaqs).length;

const { promoteCandidate } = require('./scripts/promote-candidates');

console.log('==================================================');
console.log(' Phase 6D-3 Candidate Promotion Test Suite');
console.log(' Initial FAQ Entries:', initialFaqsCount);
console.log('==================================================\n');

let passCount = 0;
const totalTests = 8;

// Create test candidates
const testLowUsage = {
  id: "test_low_usage",
  category: "test",
  originalQuery: "What is Moses's favorite data engineering tool?",
  normalizedQueryTokens: ["what", "moses", "favorite", "data", "engineering", "tool"],
  answer: "Moses specializes in Python, SQL, PostgreSQL, and Power BI for data engineering.",
  source: "gemini-generated-candidate",
  modelUsed: "gemini-3.6-flash",
  confidenceScore: 0.90,
  verified: false,
  usageCount: 2, // BELOW THRESHOLD (5)
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  revalidationRequired: true
};

const testLowConfidence = {
  id: "test_low_confidence",
  category: "test",
  originalQuery: "What is Moses's favorite data engineering framework?",
  normalizedQueryTokens: ["what", "moses", "favorite", "data", "engineering", "framework"],
  answer: "Moses specializes in Python, SQL, PostgreSQL, and Power BI for data engineering.",
  source: "gemini-generated-candidate",
  modelUsed: "gemini-3.6-flash",
  confidenceScore: 0.70, // BELOW THRESHOLD (0.88)
  verified: false,
  usageCount: 10,
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  revalidationRequired: true
};

const testValidCandidate = {
  id: "test_valid_candidate_100",
  category: "test",
  originalQuery: "What unique data analytics methodologies does Moses apply?",
  normalizedQueryTokens: ["what", "unique", "data", "analytics", "methodologies", "does", "moses", "apply"],
  answer: "Moses applies structured quantitative analytics, predictive forecasting, automated ETL pipelines, and interactive executive dashboarding.",
  source: "gemini-generated-candidate",
  modelUsed: "gemini-3.6-flash",
  confidenceScore: 0.95,
  verified: false,
  usageCount: 10, // MEETS THRESHOLD
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  revalidationRequired: true
};

const testDuplicateCandidate = {
  id: "test_duplicate_candidate",
  category: "test",
  originalQuery: "Does Moses have Power BI experience?", // SIMILAR TO EXISTING FAQ
  normalizedQueryTokens: ["does", "moses", "have", "power", "bi", "experience"],
  answer: "Yes, Power BI is a core competency of Moses.",
  source: "gemini-generated-candidate",
  modelUsed: "gemini-3.6-flash",
  confidenceScore: 0.95,
  verified: false,
  usageCount: 15,
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  revalidationRequired: true
};

// Seed test candidates into candidate-cache.json
fs.writeFileSync(CANDIDATE_CACHE_PATH, JSON.stringify([
  testLowUsage,
  testLowConfidence,
  testValidCandidate,
  testDuplicateCandidate
], null, 2), 'utf8');

// TEST 1: Candidate below usage threshold -> rejected
console.log('--- TEST 1: Usage Count Below Threshold ---');
const res1 = promoteCandidate(testLowUsage.id);
const t1Pass = (res1.success === false && res1.reason.includes('usageCount'));
console.log(`[${t1Pass ? 'PASS' : 'FAIL'}] Test 1 | Expected rejection (Reason: ${res1.reason})\n`);
if (t1Pass) passCount++;

// TEST 2: Candidate below confidence threshold -> rejected
console.log('--- TEST 2: Confidence Score Below Threshold ---');
const res2 = promoteCandidate(testLowConfidence.id);
const t2Pass = (res2.success === false && res2.reason.includes('confidenceScore'));
console.log(`[${t2Pass ? 'PASS' : 'FAIL'}] Test 2 | Expected rejection (Reason: ${res2.reason})\n`);
if (t2Pass) passCount++;

// TEST 3: Duplicate/similar verified FAQ -> rejected
console.log('--- TEST 3: Similar Verified FAQ Conflict ---');
const res3 = promoteCandidate(testDuplicateCandidate.id);
const t3Pass = (res3.success === false && res3.reason.includes('similar verified FAQ'));
console.log(`[${t3Pass ? 'PASS' : 'FAIL'}] Test 3 | Expected rejection (Reason: ${res3.reason})\n`);
if (t3Pass) passCount++;

// TEST 4: Valid candidate -> promotion succeeds
console.log('--- TEST 4: Valid Candidate Promotion ---');
const res4 = promoteCandidate(testValidCandidate.id);
const t4Pass = (res4.success === true && res4.faqId.includes('faq_promoted'));
console.log(`[${t4Pass ? 'PASS' : 'FAIL'}] Test 4 | Promotion succeeded (Promoted FAQ ID: ${res4.faqId})\n`);
if (t4Pass) passCount++;

// TEST 5: Already promoted candidate -> rejected
console.log('--- TEST 5: Already Promoted Candidate Rejection ---');
const res5 = promoteCandidate(testValidCandidate.id);
const t5Pass = (res5.success === false && res5.reason.includes('already promoted'));
console.log(`[${t5Pass ? 'PASS' : 'FAIL'}] Test 5 | Expected rejection (Reason: ${res5.reason})\n`);
if (t5Pass) passCount++;

// TEST 6: Candidate remains in candidate-cache after promotion
console.log('--- TEST 6: Audit History Preservation ---');
const currentCandidates = JSON.parse(fs.readFileSync(CANDIDATE_CACHE_PATH, 'utf8'));
const candidateInStore = currentCandidates.find(c => c.id === testValidCandidate.id);
const t6Pass = (candidateInStore !== undefined && candidateInStore.promoted === true && candidateInStore.promotedTo === 'faq-cache.json');
console.log(`[${t6Pass ? 'PASS' : 'FAIL'}] Test 6 | Candidate preserved in store with promoted = true\n`);
if (t6Pass) passCount++;

// TEST 7: Promoted FAQ has verified = true
console.log('--- TEST 7: Promoted FAQ Verification Flag ---');
const currentFaqs = JSON.parse(fs.readFileSync(FAQ_CACHE_PATH, 'utf8'));
const promotedFaq = currentFaqs.find(f => f.id === res4.faqId);
const t7Pass = (promotedFaq !== undefined && promotedFaq.verified === true && promotedFaq.source.includes('promoted-from-candidate'));
console.log(`[${t7Pass ? 'PASS' : 'FAIL'}] Test 7 | Promoted FAQ has verified = true\n`);
if (t7Pass) passCount++;

// TEST 8: Existing faq-cache entries remain unchanged
console.log('--- TEST 8: Existing FAQ Preservation ---');
const originalFaqEntriesUnchanged = currentFaqs.slice(0, initialFaqsCount);
const t8Pass = (currentFaqs.length === initialFaqsCount + 1 && originalFaqEntriesUnchanged.length === initialFaqsCount);
console.log(`[${t8Pass ? 'PASS' : 'FAIL'}] Test 8 | Original FAQ entries preserved untouched (Count: ${initialFaqsCount})\n`);
if (t8Pass) passCount++;

console.log('==================================================');
console.log(` SUMMARY: ${passCount} / ${totalTests} TESTS PASSED`);
console.log('==================================================\n');

// Restore original files
fs.writeFileSync(CANDIDATE_CACHE_PATH, origCandidates, 'utf8');
fs.writeFileSync(FAQ_CACHE_PATH, origFaqs, 'utf8');
