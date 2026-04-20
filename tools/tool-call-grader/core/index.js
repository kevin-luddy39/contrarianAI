/**
 * tool-call-grader — main entry point.
 *
 *   gradeCall(call)       — single-call signals
 *   gradeSession({calls}) — session-level audit (aggregates + pathologies + health)
 *
 * Output shape includes CI-compatible `domain.stats` over the per-call
 * relevance distribution, so the predictor-corrector can consume a
 * stream of session audits as a bell-curve trajectory.
 */

const ciCore = require('contrarianai-context-inspector');

const { extractCall } = require('./signals');
const { detectPathologies } = require('./pathologies');
const { scoreFromSignals, regime, DEFAULT_TOLERANCE } = require('./health');

function gradeCall(call) {
  return extractCall(call);
}

function gradeSession({ calls, options = {} }) {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error('gradeSession: `calls` must be a non-empty array');
  }

  const extracted = calls.map(extractCall);

  const succeeded = extracted.filter(c => c.succeeded);
  const successRate   = succeeded.length / extracted.length;
  const errorRate     = 1 - successRate;
  const structuredRate = extracted.filter(c => c.isStructured).length / extracted.length;

  // Mean relevance over succeeded calls
  const meanRelevance = succeeded.length > 0
    ? succeeded.reduce((a, c) => a + c.relevance, 0) / succeeded.length
    : 0;

  // Tool diversity — 1 − Herfindahl-Hirschman Index (normalized)
  const toolCounts = {};
  for (const c of extracted) toolCounts[c.tool] = (toolCounts[c.tool] || 0) + 1;
  const total = extracted.length;
  const hhi = Object.values(toolCounts).reduce((a, n) => a + (n / total) ** 2, 0);
  const toolDiversity = 1 - hhi;

  // Response size stats
  const sizes = extracted.map(c => c.responseSize);
  const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

  // Latency stats (when available)
  const latencies = extracted.map(c => c.latencyMs).filter(l => l != null);
  const meanLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null;

  // CI-compatible bell curve on the per-call relevance distribution
  const relevances = succeeded.map(c => c.relevance);
  const stats = ciCore.computeStats(relevances);

  const signals = {
    successRate,
    errorRate,
    structuredRate,
    meanRelevance,
    toolDiversity,
    meanSize,
    meanLatency,
  };

  const tolerance = { ...DEFAULT_TOLERANCE, ...(options.tolerance || {}) };
  const pathologies = detectPathologies({ calls: extracted }, options.thresholds);
  const health = scoreFromSignals(signals, tolerance);
  const regimeLabel = regime(health);

  return {
    callCount: extracted.length,
    domain: {
      stats,                      // bell curve of relevance scores
      scores: relevances,
    },
    toolCalls: {
      successRate,
      errorRate,
      structuredRate,
      meanRelevance,
      toolDiversity,
      meanSize,
      meanLatency,
      toolCounts,
    },
    calls: extracted,
    pathologies,
    health,
    regime: regimeLabel,
  };
}

module.exports = { gradeCall, gradeSession, DEFAULT_TOLERANCE };
