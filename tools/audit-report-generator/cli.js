#!/usr/bin/env node
/**
 * audit-report-generator CLI
 *
 * Reads a JSON config bundling the sensor outputs and emits a report.
 *
 * Usage:
 *   audit-report-generator audit-config.json
 *   audit-report-generator audit-config.json --format html --out report.html
 *
 * Config shape:
 *   {
 *     "title": "...", "client": "...", "auditor": "...", "date": "...",
 *     "contextInspector":   { ... },   // context-inspector analyze_context output
 *     "retrievalAuditor":   { ... },   // retrieval-auditor audit_retrieval output
 *     "toolCallGrader":     { ... },   // tool-call-grader grade_session output
 *     "predictorCorrector": { ... }    // predictor-corrector healthReport output
 *   }
 *
 * Any sensor field may be omitted.
 */

const fs = require('fs');
const path = require('path');
const { generateReport } = require('./core');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i++; }
      else { args[a.slice(2)] = true; }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args._[0]) {
    process.stdout.write(
      'audit-report-generator <config.json> [--format markdown|html|json] [--out path]\n'
    );
    return;
  }
  const configPath = args._[0];
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const format = args.format || 'markdown';
  const output = generateReport({ ...config, format });
  if (args.out) {
    fs.writeFileSync(args.out, output);
    process.stdout.write(`wrote ${args.out} (${output.length} bytes)\n`);
  } else {
    process.stdout.write(output + '\n');
  }
}

try { main(); }
catch (e) { process.stderr.write(`audit-report-generator: ${e.message}\n`); process.exit(1); }
