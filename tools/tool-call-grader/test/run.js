#!/usr/bin/env node
const assert = require('assert');
const { gradeCall, gradeSession } = require('../core');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.stack || e.message}`); }
}

test('gradeCall extracts signals', () => {
  const c = gradeCall({
    tool: 'search', args: { query: 'varroa mite' },
    response: { results: [{ title: 'varroa mite treatment' }] },
  });
  assert(c.succeeded);
  assert(c.isStructured);
  assert(c.relevance > 0.3, `expected relevance > 0.3, got ${c.relevance}`);
});

test('gradeCall flags error as failure', () => {
  const c = gradeCall({ tool: 'search', args: {}, error: { message: 'timeout' } });
  assert(!c.succeeded);
});

test('gradeSession returns CI-compatible stats', () => {
  const calls = [
    { tool: 'a', args: { q: 'x y z' }, response: { summary: 'x y z result' } },
    { tool: 'a', args: { q: 'x y z' }, response: { summary: 'x y related' } },
    { tool: 'b', args: { q: 'x y z' }, response: { summary: 'z y x reply' } },
  ];
  const s = gradeSession({ calls });
  assert(s.domain && s.domain.stats);
  assert(typeof s.domain.stats.mean === 'number');
  assert(Array.isArray(s.domain.stats.histogram));
  assert(s.domain.stats.histogram.length === 20);
});

test('tool fixation is detected', () => {
  const calls = Array.from({ length: 8 }, (_, i) => ({
    tool: 'search',
    args: { query: `q${i}` },
    response: { results: [] },
  }));
  const s = gradeSession({ calls });
  assert(s.pathologies.some(p => p.kind === 'TOOL_FIXATION'),
    `expected TOOL_FIXATION, got ${s.pathologies.map(p => p.kind).join(',')}`);
});

test('silent failure is detected', () => {
  const calls = Array.from({ length: 8 }, (_, i) => {
    const errored = [2, 4, 6].includes(i);
    return {
      tool: ['a', 'b', 'c', 'd'][i % 4],
      args: { q: `step ${i}` },
      response: errored ? null : { result: `ok ${i}` },
      error: errored ? { message: 'err' } : undefined,
    };
  });
  const s = gradeSession({ calls });
  assert(s.pathologies.some(p => p.kind === 'SILENT_FAILURE'));
});

test('healthy session has no pathologies', () => {
  const calls = ['search', 'summarize', 'verify', 'publish']
    .flatMap((tool, i) => [0, 1, 2].map(j => ({
      tool,
      args: { query: `topic ${tool} iteration ${j}` },
      response: { summary: `${tool} produced a structured reply about topic iteration ${j}` },
    })));
  const s = gradeSession({ calls });
  assert(s.pathologies.length === 0,
    `expected no pathologies, got ${s.pathologies.map(p => p.kind).join(',')}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
