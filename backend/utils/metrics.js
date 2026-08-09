/**
 * Zero-Cost Observability & AI Retrieval Metrics Utility (Phase 6D-4)
 * Pure native JavaScript in-memory metrics tracker for monitoring cache hits,
 * Gemini API calls, quota failures, and Gemini avoidance ratios.
 */

let metricsData = {
  totalRequests: 0,
  layer2FaqMatches: 0,
  layer3CandidateMatches: 0,
  geminiCalls: 0,
  geminiQuotaFailures: 0,
  candidateStaged: 0,
  candidateStageRejected: 0,
  startedAt: new Date().toISOString()
};

function recordRequest() {
  metricsData.totalRequests++;
}

function recordFaqHit() {
  metricsData.layer2FaqMatches++;
}

function recordCandidateHit() {
  metricsData.layer3CandidateMatches++;
}

function recordGeminiCall() {
  metricsData.geminiCalls++;
}

function recordGeminiQuotaFailure() {
  metricsData.geminiQuotaFailures++;
}

function recordCandidateStaged() {
  metricsData.candidateStaged++;
}

function recordCandidateRejected() {
  metricsData.candidateStageRejected++;
}

function resetMetrics() {
  metricsData = {
    totalRequests: 0,
    layer2FaqMatches: 0,
    layer3CandidateMatches: 0,
    geminiCalls: 0,
    geminiQuotaFailures: 0,
    candidateStaged: 0,
    candidateStageRejected: 0,
    startedAt: new Date().toISOString()
  };
}

function getMetrics() {
  const total = metricsData.totalRequests;
  const localHits = metricsData.layer2FaqMatches + metricsData.layer3CandidateMatches;
  const gCalls = metricsData.geminiCalls;

  const cacheHitRatioNum = total > 0 ? (localHits / total) * 100 : 0;
  const geminiAvoidanceNum = total > 0 ? (1 - (gCalls / total)) * 100 : 0;

  return {
    ...metricsData,
    uptimeSeconds: Math.floor((Date.now() - new Date(metricsData.startedAt).getTime()) / 1000),
    cacheHitRatio: `${cacheHitRatioNum.toFixed(2)}%`,
    geminiAvoidanceRatio: `${geminiAvoidanceNum.toFixed(2)}%`
  };
}

module.exports = {
  recordRequest,
  recordFaqHit,
  recordCandidateHit,
  recordGeminiCall,
  recordGeminiQuotaFailure,
  recordCandidateStaged,
  recordCandidateRejected,
  getMetrics,
  resetMetrics
};
