#!/usr/bin/env node
const assert = require('assert');
const { generateReport } = require('../core');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.stack || e.message}`); }
}

const sampleCI = { domain: { stats: { mean: 0.7, stdDev: 0.15, skewness: 0, kurtosis: -1, count: 10, histogram: new Array(20).fill(0.05) } }, health: 0.8, regime: 'healthy', pathologies: [] };
const sampleRA = { retrievedCount: 5, domain: { stats: { mean: 0.3, stdDev: 0.1, skewness: 0, kurtosis: 0, count: 5, histogram: new Array(20).fill(0.05) }, scores: [] }, retrieval: { rankQualityR: 0.9, scoreCalibrationR: 0.8, diversity: 0.7, redundancyRatio: 0.2, bimodalSignal: 0.05 }, health: 0.4, regime: 'contamination', pathologies: [{ kind: 'OFF_TOPIC', severity: 0.6, description: 'test' }] };

test('generates markdown with all sections', () => {
  const out = generateReport({ title: 'T', client: 'C', contextInspector: sampleCI, retrievalAuditor: sampleRA, format: 'markdown' });
  assert(out.includes('# T'));
  assert(out.includes('## Executive Summary'));
  assert(out.includes('## Context Window Analysis'));
  assert(out.includes('## Retrieval Quality'));
  assert(out.includes('OFF_TOPIC'));
});

test('omits sections when inputs missing', () => {
  const out = generateReport({ contextInspector: sampleCI, format: 'markdown' });
  assert(out.includes('## Context Window Analysis'));
  assert(!out.includes('## Retrieval Quality'));
});

test('emits valid HTML', () => {
  const out = generateReport({ contextInspector: sampleCI, format: 'html' });
  assert(out.startsWith('<!DOCTYPE html>'));
  assert(out.includes('<table>'));
});

test('emits valid JSON', () => {
  const out = generateReport({ contextInspector: sampleCI, format: 'json' });
  const parsed = JSON.parse(out);
  assert(parsed.signals && typeof parsed.signals.overallHealth === 'number');
});

test('aggregates worst-signal health', () => {
  const out = JSON.parse(generateReport({
    contextInspector: { health: 0.9, regime: 'healthy', pathologies: [] },
    retrievalAuditor: { health: 0.3, regime: 'contamination', pathologies: [] },
    format: 'json',
  }));
  assert(Math.abs(out.signals.overallHealth - 0.3) < 1e-9, 'overall = min(healths)');
});

test('pathologies cross-source show recommendations', () => {
  const out = generateReport({
    retrievalAuditor: { ...sampleRA, pathologies: [{ kind: 'OFF_TOPIC', severity: 0.8, description: 'x' }] },
    format: 'markdown',
  });
  assert(out.includes('reindexing'), 'expected reindex recommendation');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
