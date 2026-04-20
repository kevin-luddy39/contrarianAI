/**
 * Multi-agent tool-call pathologies.
 *
 * Named failure modes diagnosed from session-level aggregate signals.
 *
 *   SILENT_FAILURE  — errors exist but the agent continued as if OK
 *                     (measured by agent continuing calls after an error)
 *   TOOL_FIXATION   — one tool dominates calls beyond a healthy ratio
 *   RESPONSE_BLOAT  — a single response is orders of magnitude larger
 *                     than the session median
 *   SCHEMA_DRIFT    — structured-response rate drops over session
 *   IRRELEVANT_RESPONSES — mean arg-response relevance is low
 *   CASCADING_FAILURES — error rate grows monotonically (system
 *                        destabilising rather than transient failure)
 */

const PATHOLOGY_DEFS = {
  SILENT_FAILURE:        'tool-calls errored and the agent continued without acknowledgement',
  TOOL_FIXATION:         'one tool dominates the call distribution — agent is stuck or over-relying on a single capability',
  RESPONSE_BLOAT:        'a tool response is an order of magnitude larger than session median, likely dominating downstream context',
  SCHEMA_DRIFT:          'rate of structured responses falls across the session — tool returning malformed outputs',
  IRRELEVANT_RESPONSES:  'mean arg-to-response alignment is low — tools are returning content unrelated to requests',
  CASCADING_FAILURES:    'error rate grows monotonically — the workflow is destabilising rather than hitting transient issues',
};

function detectPathologies(session, thresholds = {}) {
  const t = {
    silentFailureMinErrors: 2,     // at least 2 errors before firing
    toolFixationRatio: 0.70,        // >=70% of calls on one tool
    responseBloatRatio: 10,         // >=10x the median
    schemaDriftMinTurns: 5,         // need at least 5 calls to compute trend
    schemaDriftSlope: -0.05,        // decreasing structured-rate
    irrelevantMeanThreshold: 0.25,
    cascadingSlope: 0.02,           // positive slope in error rate
    ...thresholds,
  };

  const out = [];
  const calls = session.calls;
  if (calls.length === 0) return out;

  // SILENT_FAILURE
  const errors = calls.filter(c => !c.succeeded);
  const continuedAfterError = errors.filter((e, idx) => {
    const globalIdx = calls.indexOf(e);
    return globalIdx < calls.length - 1;  // there were more calls after
  }).length;
  if (errors.length >= t.silentFailureMinErrors && continuedAfterError >= t.silentFailureMinErrors - 1) {
    out.push({
      kind: 'SILENT_FAILURE',
      severity: clip(continuedAfterError / calls.length * 2),
      description: PATHOLOGY_DEFS.SILENT_FAILURE,
      evidence: { errorCount: errors.length, continuedAfterError },
    });
  }

  // TOOL_FIXATION
  const toolCounts = {};
  for (const c of calls) toolCounts[c.tool] = (toolCounts[c.tool] || 0) + 1;
  const total = calls.length;
  const sortedTools = Object.entries(toolCounts).sort(([, a], [, b]) => b - a);
  const [topTool, topCount] = sortedTools[0];
  const topRatio = topCount / total;
  if (topRatio >= t.toolFixationRatio && total >= 4) {
    out.push({
      kind: 'TOOL_FIXATION',
      severity: clip((topRatio - t.toolFixationRatio) / (1 - t.toolFixationRatio)),
      description: PATHOLOGY_DEFS.TOOL_FIXATION,
      evidence: { tool: topTool, ratio: topRatio, uniqueTools: sortedTools.length },
    });
  }

  // RESPONSE_BLOAT
  const sizes = calls.map(c => c.responseSize).filter(s => s > 0);
  if (sizes.length >= 3) {
    const sorted = sizes.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    if (median > 0 && max / median >= t.responseBloatRatio) {
      out.push({
        kind: 'RESPONSE_BLOAT',
        severity: clip(Math.log10(max / median) / 2),
        description: PATHOLOGY_DEFS.RESPONSE_BLOAT,
        evidence: { maxSize: max, medianSize: median, ratio: max / median },
      });
    }
  }

  // SCHEMA_DRIFT — slope of structured-rate across session halves
  if (calls.length >= t.schemaDriftMinTurns) {
    const mid = Math.floor(calls.length / 2);
    const firstHalfRate = calls.slice(0, mid).filter(c => c.isStructured).length / mid;
    const secondHalfRate = calls.slice(mid).filter(c => c.isStructured).length / (calls.length - mid);
    const slope = secondHalfRate - firstHalfRate;
    if (slope <= t.schemaDriftSlope) {
      out.push({
        kind: 'SCHEMA_DRIFT',
        severity: clip(-slope * 3),
        description: PATHOLOGY_DEFS.SCHEMA_DRIFT,
        evidence: { firstHalfRate, secondHalfRate, slope },
      });
    }
  }

  // IRRELEVANT_RESPONSES
  const succeededCalls = calls.filter(c => c.succeeded);
  if (succeededCalls.length >= 3) {
    const meanRelevance = succeededCalls.reduce((a, c) => a + c.relevance, 0) / succeededCalls.length;
    if (meanRelevance < t.irrelevantMeanThreshold) {
      out.push({
        kind: 'IRRELEVANT_RESPONSES',
        severity: clip(1 - meanRelevance / t.irrelevantMeanThreshold),
        description: PATHOLOGY_DEFS.IRRELEVANT_RESPONSES,
        evidence: { meanRelevance },
      });
    }
  }

  // CASCADING_FAILURES — error-rate slope via windowed fraction
  if (calls.length >= 6) {
    const window = Math.max(3, Math.floor(calls.length / 4));
    const rates = [];
    for (let i = window; i <= calls.length; i++) {
      const w = calls.slice(i - window, i);
      const errRate = w.filter(c => !c.succeeded).length / w.length;
      rates.push(errRate);
    }
    // Simple linear slope over the rate series.
    const n = rates.length;
    const mx = (n - 1) / 2;
    const my = rates.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - mx) * (rates[i] - my);
      den += (i - mx) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    if (slope >= t.cascadingSlope && rates[n - 1] > rates[0]) {
      out.push({
        kind: 'CASCADING_FAILURES',
        severity: clip(slope * 5),
        description: PATHOLOGY_DEFS.CASCADING_FAILURES,
        evidence: { slope, firstRate: rates[0], finalRate: rates[n - 1] },
      });
    }
  }

  return out;
}

function clip(v) { return Math.max(0, Math.min(1, v)); }

module.exports = { detectPathologies, PATHOLOGY_DEFS };
