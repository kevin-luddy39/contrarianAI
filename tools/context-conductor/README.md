# context-conductor (Python)

> Bayesian context routing for agent workflows. Fix-side companion to the contrarianAI Bell Tuning sensor suite.

## Status

**Alpha — port in progress.** Node reference implementation at `https://github.com/kevin-luddy39/context-conductor` (archived) holds the canonical algorithm and validated sweep numbers (n=100, 0.987 ± 0.036 combined precision across four scenarios). Whitepaper §5 documents the protocol.

Port goal: implementation-agnostic Python library callable from any agent runtime (LangChain, LlamaIndex, raw OpenAI/Anthropic clients, custom). Sensor side stays Node MCP — Python conductor calls the contrarianAI MCP servers via Python MCP client.

## Why context-conductor exists

Most multi-turn AI systems silently lose money on the same problem: the context that worked on turn 1 is rarely the context that should answer turn 12. Long-running agents accumulate drift, contamination, and topical pivots — and either eat the cost of carrying a fat unified context forever, or lose state by resetting between turns.

context-conductor maintains a pool of saved contexts and decides per turn — using a switching state-space model driven by the Bell Tuning sensors — whether to keep the current context, swap in a better-fit saved one, or spawn a fresh one.

## Algorithm (whitepaper §3)

1. **Switching state-space posterior** over `P(context_i is best | observations 1..t)`. Sticky transition kernel; smooth hysteresis falls out for free.
2. **Pathology gate** — triage tree across all four Bell Tuning sensors. Swap only when deviation is confirmed as a context fault, not a sensor's-own pathology.
3. **Spawn-bias on uncertainty.** Re-priming a stale context loses subtle history; spawning is cheap. Default policy inverts the OS-paging assumption.
4. **Hysteresis + minimum residency.** Without these the algorithm thrashes.
5. **Cost-weighted eviction.** Pool size bounded by `(model_window × concurrency) / mean_context_size`.

## How it talks to the rest of the contrarianAI stack

```
contrarianAI/tools/
├── context-inspector/      ─┐
├── retrieval-auditor/      ─┤   each ships an mcp-server.js
├── tool-call-grader/       ─┤
├── predictor-corrector/    ─┘
│
└── context-conductor/  (this dir)
    └── adapters/mcp_sensors.py  → MCP client → calls the four sensor servers above
```

## Port plan

| Module                              | Status    | Source ref                       |
|-------------------------------------|-----------|----------------------------------|
| `context_conductor/config.py`       | scaffold  | Node `core/config.js`            |
| `context_conductor/posterior.py`    | scaffold  | Node `core/posterior.js`         |
| `context_conductor/pathology_gate.py` | TODO    | Node `core/pathology-gate.js`    |
| `context_conductor/pool.py`         | TODO      | Node `core/pool.js`              |
| `context_conductor/selector.py`     | TODO      | Node `core/selector.js`          |
| `context_conductor/executive.py`    | TODO      | Node `core/executive.js`         |
| `context_conductor/adapters/mcp_sensors.py` | TODO | new — replaces direct sensor calls |
| `context_conductor/adapters/langchain.py`   | TODO | new                          |
| `context_conductor/adapters/llamaindex.py`  | TODO | new                          |
| `context_conductor/adapters/raw.py`         | TODO | new                          |
| `sim/runner.py`                     | TODO      | Node `sim/runner.js`             |
| `sim/policies.py`                   | TODO      | Node `sim/policies.js`           |
| `sim/sweep.py`                      | TODO      | Node `sim/sweep.js`              |
| `sim/scenarios/`                    | TODO      | port pivot, noisy-stable, carousel, slow-creep |

## Validation gate

Python sweep must reproduce Node's combined precision of **0.987 ± 0.036 (n=100)** within Monte Carlo noise on the same four scenarios. If numbers diverge → port bug.

## Sales / consulting positioning

- **Bell Tuning audit ($15K Full Diagnostic)** = sensors diagnose pathologies in the existing agent.
- **Context Conductor Drop-In (proposed $25K SKU, 2 weeks)** = remediates the multi-context routing problem the diagnosis surfaces.
- Combined ladder ACV: $40K. Higher than diagnostic-only.

## Whitepaper

`docs/whitepaper.md` — *Mixture of Contexts: Bayesian Regime Routing for Agentic Workflows*. Carried over from the Node implementation; algorithm derivation and experiment protocol unchanged.

## License

MIT.
