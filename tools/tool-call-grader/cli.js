#!/usr/bin/env node
/**
 * tool-call-grader CLI
 *
 * Input: JSON array of tool-call records (or { calls: [...] }).
 *   [{ tool, args, response, error?, agent?, timestamp?, latency_ms? }, ...]
 *
 * Usage:
 *   tool-call-grader session.json
 *   cat session.json | tool-call-grader -
 *   tool-call-grader session.json --json   (structured JSON output)
 */

const fs = require('fs');
const { gradeSession } = require('./core');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { args[a.slice(2)] = true; }
    else args._.push(a);
  }
  return args;
}

function loadInput(args) {
  const raw = (args._[0] && args._[0] !== '-')
    ? fs.readFileSync(args._[0], 'utf8')
    : fs.readFileSync(0, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (parsed.calls || []);
}

function summarize(audit) {
  const tc = audit.toolCalls;
  const lines = [
    `calls:             ${audit.callCount}`,
    `success rate:      ${tc.successRate.toFixed(3)}`,
    `mean relevance:    ${tc.meanRelevance.toFixed(3)}`,
    `structured rate:   ${tc.structuredRate.toFixed(3)}`,
    `tool diversity:    ${tc.toolDiversity.toFixed(3)}`,
    `tool distribution: ${Object.entries(tc.toolCounts).map(([k, n]) => `${k}=${n}`).join(', ')}`,
    `health:            ${audit.health.toFixed(3)}   regime: ${audit.regime}`,
    `pathologies:       ${audit.pathologies.map(p => `${p.kind}(sev=${p.severity.toFixed(2)})`).join(', ') || '(none)'}`,
  ];
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write('tool-call-grader <session.json|->   [--json]\n');
    return;
  }
  const calls = loadInput(args);
  const audit = gradeSession({ calls });
  process.stdout.write(args.json
    ? JSON.stringify(audit, null, 2) + '\n'
    : summarize(audit) + '\n');
}

try { main(); }
catch (err) { process.stderr.write(`tool-call-grader: ${err.message}\n`); process.exit(1); }
