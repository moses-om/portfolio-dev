/**
 * Phase 6C-2 Matcher Test Suite & Benchmarking Script
 */

const path = require('path');
const { performance } = require('perf_hooks');
const faqEntries = require('./data/faq-cache.json');
const { findBestFaqMatch, DEFAULT_THRESHOLD } = require('./utils/cacheMatcher');

console.log('==================================================');
console.log(' Phase 6C-2 Zero-Cost Local Retrieval Engine Test');
console.log(' Threshold:', DEFAULT_THRESHOLD);
console.log(' Total FAQ Entries:', faqEntries.length);

const totalVariants = faqEntries.reduce((sum, entry) => sum + (entry.questions ? entry.questions.length : 0), 0);
console.log(' Total Question Variants:', totalVariants);
console.log('==================================================\n');

const testCases = [
  // Expected MATCHES
  { query: 'Does Moses have Power BI experience?', expectedMatch: true, category: 'Match Test 1' },
  { query: 'Has Moses worked with Power BI?', expectedMatch: true, category: 'Match Test 2' },
  { query: 'What BI tools does Moses know?', expectedMatch: true, category: 'Match Test 3' },
  { query: 'Where did Moses study?', expectedMatch: true, category: 'Match Test 4' },
  { query: 'Does Moses know SQL?', expectedMatch: true, category: 'Match Test 5' },
  { query: 'Tell me about his research publications.', expectedMatch: true, category: 'Match Test 6' },
  { query: 'What AI tools does Moses use?', expectedMatch: true, category: 'Match Test 7' },

  // Expected NON-MATCHES
  { query: 'What is Moses\'s favorite programming language?', expectedMatch: false, category: 'Non-Match Test 8' },
  { query: 'What salary does Moses expect?', expectedMatch: false, category: 'Non-Match Test 9' },
  { query: 'What inspired Moses to become a data analyst?', expectedMatch: false, category: 'Non-Match Test 10' },
  { query: 'Tell me a joke about Nairobi.', expectedMatch: false, category: 'Non-Match Test 11' },

  // Step 7: False Positive Edge-Case Test
  { query: 'Does Moses use Power BI for healthcare?', expectedMatch: false, category: 'Edge Case Test' }
];

let lookupTimes = [];
let passCount = 0;

console.log('--- EXECUTING TEST SUITE ---');
for (const tc of testCases) {
  const start = performance.now();
  const result = findBestFaqMatch(tc.query, faqEntries, DEFAULT_THRESHOLD);
  const duration = performance.now() - start;
  lookupTimes.push(duration);

  const passed = (result.matched === tc.expectedMatch);
  if (passed) passCount++;

  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.category} | "${tc.query}"`);
  console.log(`       Matched: ${result.matched} | Score: ${result.score.toFixed(4)} | Target ID: ${result.faqId || 'NONE'}`);
  if (result.matched) {
    console.log(`       Matched Variant: "${result.matchedQuestion}"`);
  }
  console.log(`       Lookup Time: ${duration.toFixed(4)} ms\n`);
}

// Performance Statistics
const totalTime = lookupTimes.reduce((a, b) => a + b, 0);
const avgTime = totalTime / lookupTimes.length;
const minTime = Math.min(...lookupTimes);
const maxTime = Math.max(...lookupTimes);

console.log('==================================================');
console.log(' TEST SUITE SUMMARY & PERFORMANCE BENCHMARK');
console.log('==================================================');
console.log(` Passed: ${passCount} / ${testCases.length} tests`);
console.log(` Total Entries Loaded: ${faqEntries.length}`);
console.log(` Total Question Variants Evaluated: ${totalVariants}`);
console.log(` Average Lookup Time: ${avgTime.toFixed(4)} ms`);
console.log(` Minimum Lookup Time: ${minTime.toFixed(4)} ms`);
console.log(` Maximum Lookup Time: ${maxTime.toFixed(4)} ms`);
console.log('==================================================\n');
