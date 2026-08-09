/**
 * Phase 6D-2 Candidate Retrieval Test Suite Script
 */

const fs = require('fs');
const path = require('path');

const CANDIDATE_CACHE_PATH = path.join(__dirname, 'data', 'candidate-cache.json');

// Ensure candidate cache contains at least 1 staged unverified candidate for testing
const testCandidate = {
  id: "candidate_test_certifications_001",
  category: "certifications",
  originalQuery: "What certifications is Moses currently working towards?",
  normalizedQueryTokens: ["certifications", "moses", "currently", "working", "towards"],
  answer: "Moses is currently preparing for the Microsoft PL-300 Power BI Data Analyst certification and completing the IBM Data Engineering Professional Certificate.",
  source: "gemini-generated-candidate",
  modelUsed: "gemini-3.6-flash",
  confidenceScore: 0.85,
  verified: false,
  usageCount: 1,
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  revalidationRequired: true
};

let originalData = '[]';
if (fs.existsSync(CANDIDATE_CACHE_PATH)) {
  originalData = fs.readFileSync(CANDIDATE_CACHE_PATH, 'utf8');
}

// Write test candidate to candidate-cache.json
fs.writeFileSync(CANDIDATE_CACHE_PATH, JSON.stringify([testCandidate], null, 2), 'utf8');

const { findBestCandidateMatch, CANDIDATE_THRESHOLD } = require('./utils/cacheMatcher');
const { loadCandidates } = require('./utils/candidateStore');

console.log('==================================================');
console.log(' Phase 6D-2 Candidate Retrieval Test Suite');
console.log(' Threshold:', CANDIDATE_THRESHOLD);
console.log(' Candidates Loaded:', loadCandidates().length);
console.log('==================================================\n');

let passCount = 0;
const totalTests = 5;
const candidates = loadCandidates();

// TEST 1: Exact Candidate Match
console.log('--- TEST 1: Exact Candidate Match ---');
const q1 = "What certifications is Moses currently working towards?";
const res1 = findBestCandidateMatch(q1, candidates, CANDIDATE_THRESHOLD);
const t1Pass = (res1.matched === true && res1.score >= 0.88 && res1.candidate && res1.candidate.id === testCandidate.id);
console.log(`[${t1Pass ? 'PASS' : 'FAIL'}] Test 1 | Query: "${q1}" | Matched: ${res1.matched} | Score: ${res1.score.toFixed(4)}\n`);
if (t1Pass) passCount++;

// TEST 2: Candidate Paraphrase (Strong Similarity >= 0.88)
console.log('--- TEST 2: Candidate Paraphrase (Strong Match) ---');
const q2 = "What certifications is Moses currently working towards?";
const res2 = findBestCandidateMatch(q2, candidates, CANDIDATE_THRESHOLD);
const t2Pass = (res2.matched === true && res2.score >= 0.88 && res2.candidate !== null);
console.log(`[${t2Pass ? 'PASS' : 'FAIL'}] Test 2 | Query: "${q2}" | Matched: ${res2.matched} | Score: ${res2.score.toFixed(4)}\n`);
if (t2Pass) passCount++;

// TEST 3: Unrelated Query
console.log('--- TEST 3: Unrelated Query ---');
const q3 = "Tell me a joke about Nairobi.";
const res3 = findBestCandidateMatch(q3, candidates, CANDIDATE_THRESHOLD);
const t3Pass = (res3.matched === false && res3.score < 0.88);
console.log(`[${t3Pass ? 'PASS' : 'FAIL'}] Test 3 | Query: "${q3}" | Matched: ${res3.matched} | Score: ${res3.score.toFixed(4)}\n`);
if (t3Pass) passCount++;

// TEST 4: Unknown Personal Information
console.log('--- TEST 4: Unknown Personal Information ---');
const q4 = "What is Moses's favorite ice cream?";
const res4 = findBestCandidateMatch(q4, candidates, CANDIDATE_THRESHOLD);
const t4Pass = (res4.matched === false && res4.score < 0.88);
console.log(`[${t4Pass ? 'PASS' : 'FAIL'}] Test 4 | Query: "${q4}" | Matched: ${res4.matched} | Score: ${res4.score.toFixed(4)}\n`);
if (t4Pass) passCount++;

// TEST 5: Different Portfolio Topic (Not present in candidates)
console.log('--- TEST 5: Different Portfolio Topic ---');
const q5 = "Does Moses have Power BI experience?";
const res5 = findBestCandidateMatch(q5, candidates, CANDIDATE_THRESHOLD);
const t5Pass = (res5.matched === false && res5.score < 0.88);
console.log(`[${t5Pass ? 'PASS' : 'FAIL'}] Test 5 | Query: "${q5}" | Matched: ${res5.matched} | Score: ${res5.score.toFixed(4)}\n`);
if (t5Pass) passCount++;

console.log('==================================================');
console.log(` SUMMARY: ${passCount} / ${totalTests} TESTS PASSED`);
console.log('==================================================\n');

// Restore original candidate cache
fs.writeFileSync(CANDIDATE_CACHE_PATH, originalData, 'utf8');
