/**
 * Agent Cascade — controlled scenarios.
 *
 * A synthetic multi-agent workflow where an orchestrator calls one of
 * four sub-tools per step: search, summarize, verify, publish.
 *
 * Each scenario returns an array of tool-call records with the shape:
 *   { tool, args, response, error?, latency_ms, agent, timestamp }
 *
 * Designed to exercise specific pathologies cleanly.
 */

const BASE_TS = 1_700_000_000_000;

// Realistic "good" tool responses — structured, relevant to args.
function goodResponse(tool, args) {
  switch (tool) {
    case 'search':
      return { query: args.query, results: [
        { id: 'r1', title: `${args.query} — primary result` },
        { id: 'r2', title: `${args.query} — secondary result` },
      ] };
    case 'summarize':
      return { inputId: args.inputId, summary: `Summary of ${args.inputId}: key points about ${args.query || 'the topic'}.` };
    case 'verify':
      return { claim: args.claim, verdict: 'supported', evidence: [`source A on ${args.claim.slice(0,40)}`] };
    case 'publish':
      return { docId: 'd_' + (args.inputId || 'x'), status: 'published', location: '/docs/draft.md' };
    default:
      return { ok: true };
  }
}

// Generate a "healthy" 12-step workflow: orchestrator cycles through tools.
function healthyWorkflow(steps = 12) {
  const tools = ['search', 'summarize', 'verify', 'publish'];
  const topic = 'varroa treatment';
  const calls = [];
  for (let i = 0; i < steps; i++) {
    const tool = tools[i % tools.length];
    const args = tool === 'search'    ? { query: `${topic} step ${i}` } :
                 tool === 'summarize' ? { inputId: `r${i}`, query: topic } :
                 tool === 'verify'    ? { claim: `${topic} works in winter ${i}` } :
                                        { inputId: `s${i}`, query: topic };
    calls.push({
      tool,
      agent: 'orchestrator',
      args,
      response: goodResponse(tool, args),
      latency_ms: 80 + Math.floor(Math.random() * 40),
      timestamp: BASE_TS + i * 1000,
    });
  }
  return calls;
}

// Mutations — each takes a healthy workflow and injects a specific pathology.

function injectSilentFailures(calls, errorIndices) {
  return calls.map((c, i) =>
    errorIndices.includes(i)
      ? { ...c, response: null, error: { message: `synthetic error at step ${i}` } }
      : c
  );
}

function injectFixation(calls, fixatedTool = 'search') {
  // Replace all calls with the fixated tool.
  return calls.map((c, i) => ({
    ...c,
    tool: fixatedTool,
    args: { query: `repeat probe ${i}` },
    response: goodResponse(fixatedTool, { query: `repeat probe ${i}` }),
  }));
}

function injectBloat(calls, indexToBloat) {
  // Make one response enormous — dominates context.
  const bloated = 'LOREM IPSUM '.repeat(500);
  return calls.map((c, i) =>
    i === indexToBloat
      ? { ...c, response: { ...c.response, appendix: bloated } }
      : c
  );
}

function injectSchemaDrift(calls) {
  // Second half of the session returns unstructured strings instead of objects.
  const mid = Math.floor(calls.length / 2);
  return calls.map((c, i) =>
    i >= mid
      ? { ...c, response: `free-form text reply with no schema at step ${i}` }
      : c
  );
}

function injectIrrelevant(calls) {
  // Tools succeed but respond with content unrelated to the args.
  return calls.map(c => ({
    ...c,
    response: { unrelated: 'Meanwhile in unrelated news the weather continues to change and statistics get reported.' },
  }));
}

function injectCascadingFailures(calls) {
  // Error rate grows over the session: first third clean, second third
  // 25% errors, final third 70% errors.
  const n = calls.length;
  return calls.map((c, i) => {
    const pos = i / n;
    const pErr = pos < 0.33 ? 0.0 : pos < 0.66 ? 0.25 : 0.70;
    // Deterministic "random" via index hash so the experiment is reproducible.
    const hash = ((i * 2654435761) >>> 0) / 0xFFFFFFFF;
    if (hash < pErr) {
      return { ...c, response: null, error: { message: `cascading failure at step ${i}` } };
    }
    return c;
  });
}

// Scenario catalogue.
const SCENARIOS = [
  { name: 'healthy',           expected: [],                      build: () => healthyWorkflow(12) },
  { name: 'silent-failures',   expected: ['SILENT_FAILURE'],      build: () => injectSilentFailures(healthyWorkflow(12), [3, 5, 7, 9]) },
  { name: 'tool-fixation',     expected: ['TOOL_FIXATION'],       build: () => injectFixation(healthyWorkflow(12), 'search') },
  { name: 'response-bloat',    expected: ['RESPONSE_BLOAT'],      build: () => injectBloat(healthyWorkflow(12), 4) },
  { name: 'schema-drift',      expected: ['SCHEMA_DRIFT'],        build: () => injectSchemaDrift(healthyWorkflow(12)) },
  { name: 'irrelevant',        expected: ['IRRELEVANT_RESPONSES'], build: () => injectIrrelevant(healthyWorkflow(12)) },
  { name: 'cascading',         expected: ['CASCADING_FAILURES', 'SILENT_FAILURE'], build: () => injectCascadingFailures(healthyWorkflow(16)) },
];

module.exports = {
  SCENARIOS,
  healthyWorkflow,
  injectSilentFailures,
  injectFixation,
  injectBloat,
  injectSchemaDrift,
  injectIrrelevant,
  injectCascadingFailures,
};
