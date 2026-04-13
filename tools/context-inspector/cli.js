#!/usr/bin/env node
/**
 * Context Inspector — CLI
 *
 * Usage:
 *   node cli.js <file>                       # domain alignment (default)
 *   node cli.js <file> --user                 # user alignment
 *   node cli.js <file> --chunk-size 1000      # custom chunk size
 *   node cli.js <file> --json                 # full JSON output
 *   node cli.js <file> --verbose              # detailed breakdown
 *   cat context.txt | node cli.js -           # read from stdin
 */

const fs = require('fs');
const { analyzeContext } = require('./core');

function parseArgs(argv) {
  const args = { file: null, concentrator: 'domain', chunkSize: 500, json: false, verbose: false };
  let i = 2;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--user') { args.concentrator = 'user'; }
    else if (arg === '--domain') { args.concentrator = 'domain'; }
    else if (arg === '--chunk-size' && argv[i + 1]) { args.chunkSize = parseInt(argv[++i]); }
    else if (arg === '--json') { args.json = true; }
    else if (arg === '--verbose' || arg === '-v') { args.verbose = true; }
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    else if (!args.file) { args.file = arg; }
    i++;
  }
  return args;
}

function printHelp() {
  console.log(`
context-inspector — Analyze context window alignment

Usage:
  node cli.js <file> [options]
  cat file.txt | node cli.js - [options]

Options:
  --domain         Analyze domain alignment (default)
  --user           Analyze user-specific alignment
  --chunk-size N   Set chunk size in characters (default: 500)
  --json           Output full analysis as JSON
  --verbose, -v    Show per-chunk breakdown
  --help, -h       Show this help

Output:
  Reports the standard deviation (spread) of the alignment bell curve.
  Low σ + high mean = tight alignment. High σ = scattered content.

Examples:
  node cli.js conversation.txt
  node cli.js prompt.md --user --chunk-size 300
  node cli.js system-prompt.txt --json | jq '.domain.stats'
  `);
}

function readInput(file) {
  if (!file) {
    console.error('Error: no input file specified. Use --help for usage.');
    process.exit(1);
  }
  if (file === '-') {
    return fs.readFileSync('/dev/stdin', 'utf-8');
  }
  if (!fs.existsSync(file)) {
    console.error(`Error: file not found: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf-8');
}

function printBar(value, maxWidth = 30) {
  const filled = Math.round(value * maxWidth);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(maxWidth - filled);
}

function main() {
  const args = parseArgs(process.argv);
  const text = readInput(args.file);
  const result = analyzeContext(text, { chunkSize: args.chunkSize });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const side = args.concentrator === 'user' ? result.user : result.domain;
  const stats = side.stats;
  const interp = side.interpretation;

  // Header
  console.log(`\n  context-inspector — ${args.concentrator} alignment\n`);
  console.log(`  Input:       ${text.length.toLocaleString()} chars, ${result.summary.chunkCount} chunks @ ${args.chunkSize} chars`);
  console.log(`  Mean:        ${stats.mean.toFixed(4)}`);
  console.log(`  Std Dev:     ${stats.stdDev.toFixed(4)}  [${interp.spread}]`);
  console.log(`  Median:      ${stats.median.toFixed(4)}`);
  console.log(`  Skewness:    ${stats.skewness.toFixed(4)}`);
  console.log(`  Kurtosis:    ${stats.kurtosis.toFixed(4)}`);
  console.log(`  Range:       ${stats.min.toFixed(4)} — ${stats.max.toFixed(4)}`);
  console.log(`  Alignment:   ${interp.alignment}`);
  console.log(`  Narrative:   ${interp.narrative}`);

  // ASCII histogram
  console.log(`\n  Distribution (${args.concentrator}):\n`);
  const maxDensity = Math.max(...stats.histogram);
  for (let i = 0; i < stats.histogram.length; i++) {
    const lo = (i / stats.histogram.length).toFixed(2);
    const barLen = maxDensity > 0 ? Math.round((stats.histogram[i] / maxDensity) * 40) : 0;
    console.log(`  ${lo} |${'#'.repeat(barLen)}`);
  }
  console.log(`  1.00`);

  // Top domain terms
  if (args.concentrator === 'domain') {
    console.log(`\n  Top domain terms:`);
    for (const { term, weight } of result.summary.topDomainTerms.slice(0, 10)) {
      console.log(`    ${term.padEnd(20)} ${weight.toFixed(2)}`);
    }
  }

  // Verbose: per-chunk breakdown
  if (args.verbose) {
    console.log(`\n  Per-chunk breakdown:\n`);
    console.log(`  ${'#'.padEnd(4)} ${'Score'.padEnd(8)} ${'Bar'.padEnd(32)} Preview`);
    console.log(`  ${'─'.repeat(80)}`);
    for (const chunk of result.chunks) {
      const score = args.concentrator === 'user' ? chunk.userScore : chunk.domainScore;
      const preview = chunk.text.slice(0, 50).replace(/\n/g, ' ');
      console.log(`  ${String(chunk.index).padEnd(4)} ${score.toFixed(4).padEnd(8)} ${printBar(score)} ${preview}...`);
    }
  }

  console.log('');
}

main();
