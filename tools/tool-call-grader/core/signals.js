/**
 * Per-tool-call signal extraction.
 *
 * Input: { tool, args, response, error, latency_ms, agent, timestamp }
 *
 * Signals computed per call:
 *   - succeeded     — non-null response AND no error
 *   - responseSize  — character count of stringified response
 *   - isStructured  — response parses as JSON / has expected schema
 *   - relevance     — TF-IDF cosine between args and response
 *   - latencyMs
 *
 * Session-level signals are derived in core/index.js by aggregating
 * across an array of per-call signals.
 */

const ciCore = require('contrarianai-context-inspector');

function stringify(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function isStructured(response) {
  if (response == null) return false;
  if (typeof response === 'object') return true;
  if (typeof response === 'string') {
    const s = response.trim();
    if (!s) return false;
    try { JSON.parse(s); return true; } catch { return false; }
  }
  return false;
}

/**
 * TF-IDF cosine between the stringified args and stringified response.
 * Low relevance = tool returned something unrelated to what it was
 * asked for (classic silent-failure signature when combined with an
 * apparent success status).
 */
function argResponseRelevance(args, response) {
  const aStr = stringify(args);
  const rStr = stringify(response);
  if (!aStr || !rStr) return 0;
  const aTok = ciCore.tokenize(aStr);
  const rTok = ciCore.tokenize(rStr);
  if (aTok.length === 0 || rTok.length === 0) return 0;
  return ciCore.cosineSimilarity(aTok, rTok);
}

function extractCall(call) {
  const succeeded = call.error == null && call.response != null;
  const responseSize = stringify(call.response).length;
  const structured = isStructured(call.response);
  const relevance = succeeded ? argResponseRelevance(call.args, call.response) : 0;
  return {
    tool: call.tool,
    agent: call.agent,
    timestamp: call.timestamp,
    succeeded,
    responseSize,
    isStructured: structured,
    relevance,
    latencyMs: call.latency_ms ?? call.latencyMs ?? null,
    error: call.error ?? null,
  };
}

module.exports = { extractCall, argResponseRelevance, isStructured };
