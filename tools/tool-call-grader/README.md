# tool-call-grader

> Bell Tuning instrument for multi-agent / MCP workflows. Grades tool-call quality per call and per session, detects silent failures, tool fixation, response bloat, schema drift, irrelevant responses, and cascading failures.

Completes the sensor tier alongside [`context-inspector`](../context-inspector) (context window), [`retrieval-auditor`](../retrieval-auditor) (RAG retrieval), and [`predictor-corrector`](../predictor-corrector) (forecasting).

## What it catches

| Pathology | What it looks like |
|---|---|
| `SILENT_FAILURE` | Tool returns an error; agent continues as if nothing happened |
| `TOOL_FIXATION` | One tool dominates ≥70% of calls — agent is stuck |
| `RESPONSE_BLOAT` | One response is ≥10× the session median size; dominates context |
| `SCHEMA_DRIFT` | Rate of structured responses falls across the session |
| `IRRELEVANT_RESPONSES` | Mean arg-to-response alignment below threshold |
| `CASCADING_FAILURES` | Error rate grows monotonically — system destabilising |

Each fires with a named severity in [0, 1]. The aggregate `health` score combines success rate (primary) with mean relevance, structured rate, and tool diversity (secondary, bounded penalties).

## Output shape

```js
{
  callCount,
  domain: { stats, scores },      // CI-compatible bell curve over relevance
  toolCalls: {                    // session aggregates
    successRate, errorRate, structuredRate,
    meanRelevance, toolDiversity, meanSize, meanLatency, toolCounts
  },
  calls,                          // per-call signals
  pathologies: [ {kind, severity, description, evidence}, ... ],
  health, regime
}
```

## Install & run

```bash
cd tools/tool-call-grader
npm install
npm test                         # 6 unit tests
npm run experiment               # Agent Cascade experiment
```

## CLI

```bash
cat session.json | node cli.js -
# or
node cli.js session.json --json
```

Input is a JSON array of tool-call records:
```json
[
  { "tool": "search", "args": {"query": "..."}, "response": {"results": [...]} },
  { "tool": "summarize", "args": {...}, "error": {"message": "..."} },
  ...
]
```

## MCP server

```json
{
  "mcpServers": {
    "tool-call-grader": {
      "command": "node",
      "args": ["/path/to/tools/tool-call-grader/mcp-server.js"]
    }
  }
}
```

Tools: `grade_call`, `grade_session`.

## Composition

The `domain.stats` shape matches context-inspector. A stream of session audits forms a bell-curve trajectory the `predictor-corrector` can forecast and monitor for temporal drift.

## Known limitations

1. **Lexical relevance scoring** — argument-to-response relevance uses TF-IDF cosine. Tools returning semantically-related content with no lexical overlap with arguments score low. Same limit as retrieval-auditor.
2. **Pathology thresholds are defaults** calibrated against the Agent Cascade experiment. Production usage should re-calibrate against a clean-session sample from the target workflow.
3. **Latency analysis is opportunistic** — `latency_ms` is reported if provided, not required. Latency pathologies are a v1.1 addition.

See [`docs/whitepaper-agent-cascade.md`](docs/whitepaper-agent-cascade.md) for the full experiment and analysis.

## License

MIT
