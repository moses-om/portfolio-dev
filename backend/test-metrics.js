/**
 * Phase 6D-4 Observability & AI Retrieval Metrics Test Suite Script
 */

const {
  recordRequest,
  recordFaqHit,
  recordCandidateHit,
  recordGeminiCall,
  recordGeminiQuotaFailure,
  recordCandidateStaged,
  recordCandidateRejected,
  getMetrics,
  resetMetrics
} = require('./utils/metrics');

console.log('==================================================');
console.log(' Phase 6D-4 Metrics Engine Test Suite');
console.log('==================================================\n');

let passCount = 0;
const totalTests = 10;

// TEST 1: Initial metrics are zero & Division-By-Zero handling
resetMetrics();
const initialMetrics = getMetrics();
const t1Pass = (
  initialMetrics.totalRequests === 0 &&
  initialMetrics.layer2FaqMatches === 0 &&
  initialMetrics.layer3CandidateMatches === 0 &&
  initialMetrics.geminiCalls === 0 &&
  initialMetrics.cacheHitRatio === "0.00%" &&
  initialMetrics.geminiAvoidanceRatio === "0.00%"
);
console.log(`[${t1Pass ? 'PASS' : 'FAIL'}] Test 1: Initial metrics zero & Division-by-zero handled safely (${initialMetrics.cacheHitRatio})\n`);
if (t1Pass) passCount++;

// TEST 2: Request count increments
recordRequest();
recordRequest();
const t2Metrics = getMetrics();
const t2Pass = (t2Metrics.totalRequests === 2);
console.log(`[${t2Pass ? 'PASS' : 'FAIL'}] Test 2: Request count incremented (Count: ${t2Metrics.totalRequests})\n`);
if (t2Pass) passCount++;

// TEST 3: FAQ hit increments
recordFaqHit();
const t3Metrics = getMetrics();
const t3Pass = (t3Metrics.layer2FaqMatches === 1);
console.log(`[${t3Pass ? 'PASS' : 'FAIL'}] Test 3: FAQ hit incremented (Count: ${t3Metrics.layer2FaqMatches})\n`);
if (t3Pass) passCount++;

// TEST 4: Candidate hit increments
recordCandidateHit();
const t4Metrics = getMetrics();
const t4Pass = (t4Metrics.layer3CandidateMatches === 1);
console.log(`[${t4Pass ? 'PASS' : 'FAIL'}] Test 4: Candidate hit incremented (Count: ${t4Metrics.layer3CandidateMatches})\n`);
if (t4Pass) passCount++;

// TEST 5: Gemini call increments
recordGeminiCall();
const t5Metrics = getMetrics();
const t5Pass = (t5Metrics.geminiCalls === 1);
console.log(`[${t5Pass ? 'PASS' : 'FAIL'}] Test 5: Gemini call incremented (Count: ${t5Metrics.geminiCalls})\n`);
if (t5Pass) passCount++;

// TEST 6: Quota failure increments
recordGeminiQuotaFailure();
const t6Metrics = getMetrics();
const t6Pass = (t6Metrics.geminiQuotaFailures === 1);
console.log(`[${t6Pass ? 'PASS' : 'FAIL'}] Test 6: Quota failure incremented (Count: ${t6Metrics.geminiQuotaFailures})\n`);
if (t6Pass) passCount++;

// TEST 7: Cache hit ratio calculation
// Total requests: 2, Local Hits (FAQ: 1 + Candidate: 1 = 2) -> Ratio: 100.00%
const t7Metrics = getMetrics();
const t7Pass = (t7Metrics.cacheHitRatio === "100.00%");
console.log(`[${t7Pass ? 'PASS' : 'FAIL'}] Test 7: Cache hit ratio calculated correctly (${t7Metrics.cacheHitRatio})\n`);
if (t7Pass) passCount++;

// TEST 8: Gemini avoidance ratio calculation
// Total requests: 2, Gemini calls: 1 -> Avoidance: 1 - (1/2) = 50.00%
const t8Metrics = getMetrics();
const t8Pass = (t8Metrics.geminiAvoidanceRatio === "50.00%");
console.log(`[${t8Pass ? 'PASS' : 'FAIL'}] Test 8: Gemini avoidance ratio calculated correctly (${t8Metrics.geminiAvoidanceRatio})\n`);
if (t8Pass) passCount++;

// TEST 9: Candidate Staged & Rejected metrics
recordCandidateStaged();
recordCandidateRejected();
const t9Metrics = getMetrics();
const t9Pass = (t9Metrics.candidateStaged === 1 && t9Metrics.candidateStageRejected === 1);
console.log(`[${t9Pass ? 'PASS' : 'FAIL'}] Test 9: Staged & Rejected metrics incremented correctly (Staged: ${t9Metrics.candidateStaged}, Rejected: ${t9Metrics.candidateStageRejected})\n`);
if (t9Pass) passCount++;

// TEST 10: Reset functionality
resetMetrics();
const t10Metrics = getMetrics();
const t10Pass = (t10Metrics.totalRequests === 0 && t10Metrics.geminiCalls === 0 && t10Metrics.layer2FaqMatches === 0);
console.log(`[${t10Pass ? 'PASS' : 'FAIL'}] Test 10: Metrics reset back to zero successfully\n`);
if (t10Pass) passCount++;

console.log('==================================================');
console.log(` SUMMARY: ${passCount} / ${totalTests} TESTS PASSED`);
console.log('==================================================\n');
