#!/usr/bin/env node
/**
 * Agent Cascade — experiment runner.
 *
 * For each scenario in sim/agent-cascade/scenarios.js:
 *   1. Build a synthetic multi-agent session.
 *   2. Run gradeSession on it.
 *   3. Check whether expected pathology flags fired.
 *   4. Record health, regime, flags, and key signals.
 *
 * Also produces a compact multi-scenario summary table.
 */

const fs = require('fs');
const path = require('path');

const { gradeSession } = require('../../core');
const { SCENARIOS } = require('./scenarios');

function runScenario(sc) {
  const calls = sc.build();
  const result = gradeSession({ calls });
  const firedKinds = result.pathologies.map(p => p.kind);
  const expectedSet = new Set(sc.expected);
  const expectedFired = [...expectedSet].every(k => firedKinds.includes(k));

  return {
    scenario: sc.name,
    callCount: calls.length,
    expected: sc.expected,
    fired: firedKinds,
    expectedAllFired: expectedFired,
    pass: expectedFired,
    health: result.health,
    regime: result.regime,
    toolCalls: result.toolCalls,
    stats: result.domain.stats,
    pathologies: result.pathologies,
  };
}

function pad(s, n) { return String(s).padEnd(n); }
function fmt(v, n, d = 3) {
  if (v == null) return '—'.padStart(n);
  if (typeof v === 'number') return v.toFixed(d).padStart(n);
  return String(v).padStart(n);
}

function main() {
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });

  const rows = SCENARIOS.map(runScenario);

  const lines = [];
  lines.push('Agent Cascade — experiment summary');
  lines.push('==================================');
  lines.push('');
  lines.push('scenario              calls  success  relev  struct  divers  health  regime          result  fired vs expected');
  lines.push('-----------------     -----  -------  -----  ------  ------  ------  --------------  ------  -------------------------------------------');
  for (const r of rows) {
    const exp = r.expected.join(',') || '(none)';
    const fired = r.fired.join(',') || '(none)';
    lines.push([
      pad(r.scenario, 20),
      pad(r.callCount, 6),
      fmt(r.toolCalls.successRate, 8),
      fmt(r.toolCalls.meanRelevance, 6),
      fmt(r.toolCalls.structuredRate, 7),
      fmt(r.toolCalls.toolDiversity, 7),
      fmt(r.health, 7),
      pad(r.regime, 15),
      r.pass ? 'PASS  ' : 'FAIL  ',
      `expected=${exp}  fired=${fired}`,
    ].join(' '));
  }
  lines.push('');

  // Per-pathology detection summary
  const kinds = ['SILENT_FAILURE','TOOL_FIXATION','RESPONSE_BLOAT','SCHEMA_DRIFT','IRRELEVANT_RESPONSES','CASCADING_FAILURES'];
  lines.push('Pathology detection grid (rows = scenario, columns = pathology fired):');
  lines.push('                         ' + kinds.map(k => pad(k.slice(0, 8), 9)).join(''));
  for (const r of rows) {
    const row = pad(r.scenario, 24) + kinds.map(k =>
      pad(r.fired.includes(k) ? (r.expected.includes(k) ? '  ✓ ' : '  ✦ ') : '   ·', 9)
    ).join('');
    lines.push(row);
  }
  lines.push('');
  lines.push('  ✓ = expected and fired   ✦ = fired but not expected   · = did not fire');
  lines.push('');
  lines.push(`Pass rate: ${rows.filter(r => r.pass).length}/${rows.length}`);

  const summary = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({
    experiment: 'agent-cascade',
    scenarios: rows,
  }, null, 2));
  process.stdout.write(summary);
}

main();
