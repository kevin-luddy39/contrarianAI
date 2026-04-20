#!/usr/bin/env node
/**
 * End-to-end example: consume outputs from the three sister-tool
 * experiments (Unseen Tide, RAG Needle, Agent Cascade) and generate a
 * unified audit report in markdown and HTML.
 *
 * Demonstrates the "Audit-in-a-Box" productization flow:
 *   sensor outputs → generator → deliverable report
 */

const fs = require('fs');
const path = require('path');
const { generateReport } = require('../../core');

const outDir = path.join(__dirname, 'outputs');
const inDir  = path.join(__dirname, 'inputs');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(inDir,  { recursive: true });

// ── Sourced inputs from real experiment runs ────────────────
// These are loaded from the experiment JSON outputs. If those files
// don't exist yet (someone cloned fresh and skipped the experiments),
// fall back to embedded minimal stubs so the demo still runs.
function safeLoad(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const unseenTideResults = safeLoad(path.resolve(
  __dirname, '..', '..', '..', 'predictor-corrector', 'sim', 'unseen-tide', 'results', 'results.json',
));
const ragNeedleResults = safeLoad(path.resolve(
  __dirname, '..', '..', '..', 'retrieval-auditor', 'sim', 'rag-needle', 'results', 'results.json',
));
const agentCascadeResults = safeLoad(path.resolve(
  __dirname, '..', '..', '..', 'tool-call-grader', 'sim', 'agent-cascade', 'results', 'results.json',
));

// Pick representative snapshots from each experiment so the report
// demonstrates each sensor's output shape. We choose a turn where
// contamination is present so the report shows non-trivial pathology
// flags.

const contextInspector = (() => {
  if (!unseenTideResults) return stubContextInspector();
  // Grab turn 22 (adjacent-domain creep) — clearly degraded but not rot yet
  const turn = unseenTideResults.rows?.find(r => r.turn === 22);
  if (!turn) return stubContextInspector();
  return {
    domain: {
      stats: {
        mean: turn.mean,
        stdDev: turn.stdDev,
        skewness: turn.skew,
        kurtosis: turn.kurt,
        count: turn.count,
        histogram: turn.histogram || syntheticHistogram(turn.mean, turn.stdDev),
      },
    },
    health: 1 - Math.abs(turn.mean - unseenTideResults.baseline.mean) / 0.3,
    regime: 'drift',
    pathologies: [],
  };
})();

const retrievalAuditor = (() => {
  if (!ragNeedleResults) return stubRetrievalAuditor();
  // Pick the off-topic-swap scenario from Part A for the demo report.
  const sc = ragNeedleResults.partA?.scenarios?.find(s => s.scenario.startsWith('off-topic-swap'));
  if (!sc) return stubRetrievalAuditor();
  return {
    domain: { stats: sc.stats, scores: [] },
    retrieval: sc.signals,
    health: sc.health,
    regime: sc.regime,
    retrievedCount: sc.retrieved?.length || 5,
    pathologies: sc.pathologies || [],
  };
})();

const toolCallGrader = (() => {
  if (!agentCascadeResults) return stubToolCallGrader();
  // Cascading-failures scenario.
  const sc = agentCascadeResults.scenarios?.find(s => s.scenario === 'cascading');
  if (!sc) return stubToolCallGrader();
  return {
    callCount: sc.callCount,
    domain: { stats: sc.stats, scores: [] },
    toolCalls: sc.toolCalls,
    calls: [],
    pathologies: sc.pathologies || [],
    health: sc.health,
    regime: sc.regime,
  };
})();

const predictorCorrector = {
  engine: 'abm',
  health: 0.42,
  regime: 'contamination',
  historyLen: 22,
  signals: {
    forecastError:    0.18,
    baselineDistance: 0.21,
    milneError:       0.003,
  },
};

// ── Generate in both markdown and HTML ─────────────────────
const markdown = generateReport({
  title: 'Bell Tuning Audit — Acme Corp Live Agent',
  client: 'Acme Corp',
  auditor: 'contrarianAI',
  date: '2026-04-19',
  contextInspector,
  retrievalAuditor,
  toolCallGrader,
  predictorCorrector,
  format: 'markdown',
});

const html = generateReport({
  title: 'Bell Tuning Audit — Acme Corp Live Agent',
  client: 'Acme Corp',
  auditor: 'contrarianAI',
  date: '2026-04-19',
  contextInspector,
  retrievalAuditor,
  toolCallGrader,
  predictorCorrector,
  format: 'html',
});

const json = generateReport({
  title: 'Bell Tuning Audit — Acme Corp Live Agent',
  client: 'Acme Corp',
  auditor: 'contrarianAI',
  date: '2026-04-19',
  contextInspector,
  retrievalAuditor,
  toolCallGrader,
  predictorCorrector,
  format: 'json',
});

fs.writeFileSync(path.join(outDir, 'report.md'),   markdown);
fs.writeFileSync(path.join(outDir, 'report.html'), html);
fs.writeFileSync(path.join(outDir, 'report.json'), json);

// Save the input bundle too for transparency
fs.writeFileSync(path.join(inDir, 'bundle.json'), JSON.stringify({
  contextInspector, retrievalAuditor, toolCallGrader, predictorCorrector,
}, null, 2));

process.stdout.write([
  '✓ wrote sim/example-audit/outputs/report.md   (markdown)',
  '✓ wrote sim/example-audit/outputs/report.html (html)',
  '✓ wrote sim/example-audit/outputs/report.json (json)',
  '✓ wrote sim/example-audit/inputs/bundle.json  (raw inputs for transparency)',
  `  markdown length: ${markdown.length} bytes`,
  `  html length:     ${html.length} bytes`,
].join('\n') + '\n');

// ── stubs used if experiments haven't been run yet ─────────

function stubContextInspector() {
  return {
    domain: {
      stats: { mean: 0.55, stdDev: 0.25, skewness: -0.3, kurtosis: -0.9, count: 28,
               histogram: syntheticHistogram(0.55, 0.25) },
    },
    health: 0.52,
    regime: 'contamination',
    pathologies: [],
  };
}
function stubRetrievalAuditor() {
  return {
    retrievedCount: 5,
    domain: { stats: { mean: 0.23, stdDev: 0.08, skewness: 0.1, kurtosis: -0.4, count: 5,
                       histogram: syntheticHistogram(0.23, 0.08) }, scores: [] },
    retrieval: { rankQualityR: 0.10, scoreCalibrationR: 0.20, diversity: 0.65, redundancyRatio: 0.12, bimodalSignal: 0.30 },
    health: 0.38,
    regime: 'contamination',
    pathologies: [{ kind: 'OFF_TOPIC', severity: 0.7, description: 'Low query-to-chunk alignment.' }],
  };
}
function stubToolCallGrader() {
  return {
    callCount: 12,
    domain: { stats: { mean: 0.5, stdDev: 0.2, skewness: 0, kurtosis: -0.5, count: 8,
                       histogram: syntheticHistogram(0.5, 0.2) }, scores: [] },
    toolCalls: { successRate: 0.67, errorRate: 0.33, structuredRate: 0.67, meanRelevance: 0.45, toolDiversity: 0.6,
                 toolCounts: { search: 4, summarize: 3, verify: 2, publish: 3 } },
    calls: [],
    pathologies: [{ kind: 'SILENT_FAILURE', severity: 0.55, description: 'Errors followed by continued calls.' }],
    health: 0.72,
    regime: 'drift',
  };
}
function syntheticHistogram(mean, stdDev, bins = 20) {
  const out = new Array(bins).fill(0);
  if (stdDev <= 0) { out[Math.min(bins - 1, Math.floor(mean * bins))] = 1; return out; }
  const dx = 1 / bins;
  let total = 0;
  for (let i = 0; i < bins; i++) {
    const x = (i + 0.5) * dx;
    const z = (x - mean) / stdDev;
    out[i] = Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
    total += out[i];
  }
  return out.map(v => v / (total || 1));
}
