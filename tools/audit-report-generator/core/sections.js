/**
 * Report section builders.
 *
 * Each function takes one sensor's output and returns a markdown
 * section. Sections are pure — no I/O — so the same builder can
 * produce markdown, HTML (via a renderer), or JSON fragments.
 */

function executiveSummary({ inputs, signals }) {
  const lines = [];
  lines.push('## Executive Summary\n');
  lines.push(`**Audit date:** ${signals.auditDate}\n`);
  lines.push(`**Overall health:** ${scoreLabel(signals.overallHealth)} (${signals.overallHealth.toFixed(2)} / 1.00)  \n`);
  lines.push(`**Regime:** ${signals.overallRegime}\n`);
  lines.push(`**Pathologies found:** ${signals.totalPathologies}\n`);
  lines.push('');
  lines.push('### Inputs audited');
  for (const [key, inp] of Object.entries(inputs)) {
    if (!inp) continue;
    lines.push(`- **${labelForInput(key)}** — ${describeInput(key, inp)}`);
  }
  lines.push('');
  if (signals.topFindings.length > 0) {
    lines.push('### Top findings');
    signals.topFindings.forEach((f, i) => {
      lines.push(`${i + 1}. **${f.kind}** (sev ${f.severity.toFixed(2)}, source: ${f.source}) — ${f.description}`);
    });
    lines.push('');
  }
  if (signals.recommendedActions.length > 0) {
    lines.push('### Recommended actions');
    signals.recommendedActions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function contextInspectorSection(ci) {
  if (!ci) return '';
  const side = ci.domain?.stats || ci.stats || {};
  const lines = [];
  lines.push('## Context Window Analysis\n');
  lines.push('Bell-curve statistics over the current context-window chunks.\n');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| health | ${fmt(ci.health)} |`);
  lines.push(`| regime | ${ci.regime || '—'} |`);
  lines.push(`| mean alignment | ${fmt(side.mean)} |`);
  lines.push(`| stdDev | ${fmt(side.stdDev)} |`);
  lines.push(`| skewness | ${fmt(side.skewness)} |`);
  lines.push(`| kurtosis | ${fmt(side.kurtosis)} |`);
  lines.push(`| chunk count | ${side.count ?? '—'} |`);
  lines.push('');
  if (Array.isArray(side.histogram) && side.histogram.length > 0) {
    lines.push('Histogram (20 bins across [0, 1]):');
    lines.push('```');
    lines.push(asciiHistogram(side.histogram));
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}

function retrievalAuditorSection(ra) {
  if (!ra) return '';
  const lines = [];
  lines.push('## Retrieval Quality\n');
  const r = ra.retrieval || {};
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| health | ${fmt(ra.health)} |`);
  lines.push(`| regime | ${ra.regime} |`);
  lines.push(`| rank-quality R | ${fmt(r.rankQualityR)} |`);
  lines.push(`| diversity | ${fmt(r.diversity)} |`);
  lines.push(`| redundancy ratio | ${fmt(r.redundancyRatio)} |`);
  lines.push(`| score calibration R | ${fmt(r.scoreCalibrationR)} |`);
  lines.push(`| bimodal signal | ${fmt(r.bimodalSignal)} |`);
  lines.push('');
  if (Array.isArray(ra.pathologies) && ra.pathologies.length > 0) {
    lines.push('### Retrieval pathologies');
    for (const p of ra.pathologies) {
      lines.push(`- **${p.kind}** (severity ${p.severity.toFixed(2)}) — ${p.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function toolCallGraderSection(tg) {
  if (!tg) return '';
  const tc = tg.toolCalls || {};
  const lines = [];
  lines.push('## Multi-Agent Tool-Call Analysis\n');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| health | ${fmt(tg.health)} |`);
  lines.push(`| regime | ${tg.regime} |`);
  lines.push(`| call count | ${tg.callCount} |`);
  lines.push(`| success rate | ${fmt(tc.successRate)} |`);
  lines.push(`| structured rate | ${fmt(tc.structuredRate)} |`);
  lines.push(`| mean relevance | ${fmt(tc.meanRelevance)} |`);
  lines.push(`| tool diversity | ${fmt(tc.toolDiversity)} |`);
  if (tc.toolCounts) {
    lines.push(`| tool distribution | ${Object.entries(tc.toolCounts).map(([k, n]) => `${k}=${n}`).join(', ')} |`);
  }
  lines.push('');
  if (Array.isArray(tg.pathologies) && tg.pathologies.length > 0) {
    lines.push('### Tool-call pathologies');
    for (const p of tg.pathologies) {
      lines.push(`- **${p.kind}** (severity ${p.severity.toFixed(2)}) — ${p.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function predictorCorrectorSection(pc) {
  if (!pc) return '';
  const lines = [];
  lines.push('## Trajectory Forecast\n');
  lines.push('Forecaster state reflects the predicted evolution of the context-window bell curve under healthy dynamics.\n');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| engine | ${pc.engine || '—'} |`);
  lines.push(`| health | ${fmt(pc.health)} |`);
  lines.push(`| regime | ${pc.regime || '—'} |`);
  lines.push(`| history length | ${pc.historyLen ?? '—'} |`);
  lines.push(`| forecast error | ${fmt(pc.signals?.forecastError)} |`);
  lines.push(`| baseline distance | ${fmt(pc.signals?.baselineDistance)} |`);
  lines.push(`| Milne error (ABM only) | ${fmt(pc.signals?.milneError)} |`);
  lines.push('');
  return lines.join('\n');
}

function appendix(inputs) {
  const lines = [];
  lines.push('## Appendix — Raw Input Summary\n');
  lines.push('```json');
  lines.push(JSON.stringify(compactSummary(inputs), null, 2));
  lines.push('```\n');
  return lines.join('\n');
}

// ── helpers ────────────────────────────────────────────────

function scoreLabel(v) {
  if (v >= 0.85) return '🟢 healthy';
  if (v >= 0.60) return '🟡 drift';
  if (v >= 0.30) return '🟠 contamination';
  return '🔴 rot';
}

function labelForInput(key) {
  return ({
    contextInspector:    'Context Window (context-inspector)',
    retrievalAuditor:    'Retrieval Quality (retrieval-auditor)',
    toolCallGrader:      'Multi-Agent Tool Calls (tool-call-grader)',
    predictorCorrector:  'Trajectory Forecast (predictor-corrector)',
  })[key] || key;
}

function describeInput(key, inp) {
  if (key === 'contextInspector') {
    const count = inp.domain?.stats?.count ?? inp.stats?.count ?? '?';
    return `${count} chunks`;
  }
  if (key === 'retrievalAuditor') return `${inp.retrievedCount || inp.domain?.scores?.length || '?'} chunks audited`;
  if (key === 'toolCallGrader') return `${inp.callCount || '?'} tool calls`;
  if (key === 'predictorCorrector') return `history length ${inp.historyLen ?? '?'}`;
  return '';
}

function compactSummary(inputs) {
  const out = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (!v) continue;
    out[k] = {
      health: v.health,
      regime: v.regime,
      pathologies: (v.pathologies || []).map(p => ({ kind: p.kind, severity: p.severity })),
    };
  }
  return out;
}

function asciiHistogram(hist, width = 40) {
  const max = Math.max(...hist, 1e-9);
  return hist.map((v, i) => {
    const bar = '#'.repeat(Math.round((v / max) * width));
    const bin = ((i + 0.5) / hist.length).toFixed(2);
    return `${bin}  ${bar}`;
  }).join('\n');
}

function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return v.toFixed(4);
  return String(v);
}

module.exports = {
  executiveSummary,
  contextInspectorSection,
  retrievalAuditorSection,
  toolCallGraderSection,
  predictorCorrectorSection,
  appendix,
};
