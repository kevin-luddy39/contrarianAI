# The Agent Cascade: Detecting Six Distinct Multi-Agent Tool-Call Pathologies

**Controlled evaluation of tool-call-grader against six hand-injected failure modes in synthetic multi-agent MCP workflows.**

---

## Abstract

Production multi-agent systems fail silently. An orchestrator agent calls a sub-tool; the tool errors; the agent continues as if the response were valid; the downstream LLM generates text grounded in nothing; the user sees plausible output with no signal of degradation.

We test whether a session-level grader combining **success rate + arg-to-response relevance + structured-response rate + tool diversity** plus six named pathology detectors can diagnose the specific class of failure in a synthetic workflow.

**Result: 7/7 scenarios pass.** A healthy 12-call workflow produces zero pathology flags. Each of six injected pathologies (silent failures, tool fixation, response bloat, schema drift, irrelevant responses, cascading failures) is correctly diagnosed by the designed flag, often with correlated co-fires that are logically consistent (e.g., cascading failures also trips schema-drift because error responses are unstructured).

> **Key finding.** A 500-line JavaScript grader running session-level statistics plus six pattern detectors achieves perfect detection on a hand-designed six-pathology benchmark, with zero false positives on the healthy control. The significance is not the grader's sophistication but its demonstration that the *sensor-tier framework* from context-inspector, applied to the agent/MCP domain, produces another clean diagnostic surface.

---

## 1. Motivation

Multi-agent workflows are the 2026 AI growth category. LangGraph, OpenAI Swarm, MCP-driven orchestration, Agentic RAG — they all share the same failure topology: *tools failing in ways the calling agent does not notice*.

Existing tooling focuses on correctness of individual calls (did the tool return what was expected?) or end-to-end task completion (did the user get their result?). Neither catches the middle layer where most failures live: the session-level *pattern* of tool calls diverging from healthy shape.

Bell Tuning (context-inspector) established that the statistical distribution of context-chunk alignment is a leading indicator of output quality. The same discipline applied to tool-call distributions should yield analogous signals. This paper tests that hypothesis on a designed benchmark.

---

## 2. Experimental design

### 2.1 The synthetic workflow

A healthy 12-call session uses four tools in rotation: `search → summarize → verify → publish`. Each tool takes args and returns a structured response relevant to those args. The orchestrator agent is notional — what we score is the *log of tool calls* it produces, not the agent itself.

Input shape per call:
```js
{ tool, args, response, error?, agent, timestamp, latency_ms }
```

### 2.2 Six injected pathologies

Each scenario takes the healthy workflow and applies one deterministic mutation:

| Scenario | Mutation |
|---|---|
| `silent-failures` | Set 4 of 12 responses to null and attach error objects |
| `tool-fixation` | Replace all calls' `tool` field with `search` |
| `response-bloat` | Inject a 5,500-char appendix into one response |
| `schema-drift` | Convert second-half responses from objects to free-form strings |
| `irrelevant` | Replace all responses with content semantically unrelated to args |
| `cascading` | Graduated error injection — 0% → 25% → 70% across thirds |

All mutations are deterministic (no RNG outside a seeded hash); results reproduce exactly.

### 2.3 Scoring

Per-call signals: `succeeded`, `responseSize`, `isStructured`, `relevance` (TF-IDF cosine between args and response), `latencyMs`.

Session aggregates: `successRate`, `errorRate`, `structuredRate`, `meanRelevance`, `toolDiversity` (1 − Herfindahl-Hirschman index on tool distribution), `meanSize`.

Pathology detectors: six rule-based detectors reading aggregate signals with calibrated thresholds. Health score = primary (success rate) + bounded penalties from secondaries.

Success criterion: all pathologies in a scenario's `expected` set fire on the scenario's audit output. Extra pathologies firing is acceptable if they are logically implied by the mutation (documented per-scenario).

---

## 3. Results

```
scenario              calls  success  relev  struct  divers  health  regime    result
-----------------     -----  -------  -----  ------  ------  ------  -------   ------
healthy                 12    1.000   0.594   1.000   0.750   1.000  healthy    PASS
silent-failures         12    0.667   0.697   0.667   0.750   0.826  healthy    PASS
tool-fixation           12    1.000   0.652   1.000   0.000   0.850  healthy    PASS
response-bloat          12    1.000   0.535   1.000   0.750   1.000  healthy    PASS
schema-drift            12    1.000   0.341   0.500   0.750   0.953  healthy    PASS
irrelevant              12    1.000   0.000   1.000   0.750   0.850  healthy    PASS
cascading               16    0.688   0.567   0.688   0.750   0.857  healthy    PASS
```

Pass rate: **7/7 (100%)**. Pathology detection grid:

```
                     SILENT   TOOL_FIX   RESPONSE   SCHEMA   IRRELEVANT   CASCADING
healthy                 ·        ·          ·         ·          ·           ·
silent-failures         ✓        ·          ·         ·          ·          ✦
tool-fixation           ·       ✓           ·         ·          ·           ·
response-bloat          ·        ·         ✓          ·          ·           ·
schema-drift            ·        ·          ·        ✓           ·           ·
irrelevant              ·        ·          ·         ·         ✓            ·
cascading              ✓         ·          ·        ✦           ·          ✓
```

`✓` = expected and fired. `✦` = fired but not in the scenario's expected set (logically implied co-fire). `·` = did not fire.

### 3.1 Expected co-fires

Two scenarios produce co-fires:

- **silent-failures → CASCADING_FAILURES**: The four injected errors happen to create a growing error-rate slope over the 12-call window. The cascading detector is doing its job; the scenario genuinely exhibits both patterns.
- **cascading → SCHEMA_DRIFT**: Error responses are `null` (unstructured). With 70% errors in the final third, the structured-response rate collapses in the back half, trip­ping the schema-drift detector. Logically consistent — erroring tools don't return schemas.

Both co-fires are *informative*, not false positives. A downstream system should report both and let the human operator interpret.

### 3.2 Health score vs pathology flags

Several scenarios have high health (e.g., `tool-fixation` at 0.850, `response-bloat` at 1.000) despite pathology flags firing. This is by design:

- Health aggregates success rate + relevance + structure + diversity into a single scalar for dashboards.
- The pathology flags are the specific diagnostic signal.

Response bloat is the cleanest example: the workflow succeeded on every call (success rate 1.0), returned structured responses (structured rate 1.0), and hit every tool (diversity 0.75). The aggregate looks clean. But one response is 10× the median size and will dominate the downstream LLM's context window. That's exactly what RESPONSE_BLOAT is designed to catch — a pattern-level defect that aggregate-statistics can't see.

**Recommended downstream gating:**
```js
degraded = audit.health < 0.7 || audit.pathologies.some(p => p.severity > 0.5)
```

---

## 4. Analysis

### 4.1 What the sensor-tier framework reveals

Applying the same shape as context-inspector (per-X alignment scores → bell curve → pathology detection) to the agent-call domain produces a clean diagnostic surface with minimal code (≈500 lines core). This suggests the underlying framework — "apply statistical shape analysis to whatever vector your AI system emits" — is generalisable beyond context windows.

The natural extensions are:
- **tool-output-auditor**: per-call response-quality score for RAG-assisted tools (already partly covered by `IRRELEVANT_RESPONSES`)
- **handoff-auditor**: multi-agent hand-offs where agent A's output becomes agent B's input; measure topic continuity
- **rollup-auditor**: multi-level agent hierarchies where a top orchestrator summarises sub-agent outputs

### 4.2 The contrarian position

Most multi-agent observability tools focus on two things: (1) per-call correctness (did each tool return something valid) and (2) end-to-end evaluation (did the user get their result). Both miss the middle layer — the *pattern* of calls diverging from healthy shape before either of those measurements fires.

The contrarian position: **most agent failures are detectable from the tool-call pattern alone, without LLM evaluation of outputs and without ground truth**. This experiment is a proof-of-concept on a small-scale synthetic benchmark. Production validation is ongoing.

### 4.3 Limitations

1. **Synthetic workflow.** Real multi-agent traces have more varied tool signatures, latency distributions, and error taxonomies. Thresholds calibrated here are starting points, not universal constants.
2. **Lexical-only relevance.** Arg-to-response relevance uses TF-IDF. Tools that return semantically-rich but lexically-disjoint content score poorly. Same limit as retrieval-auditor; same mitigation (embedding-based backend, v1.1).
3. **No LLM-call auditing.** The grader reads tool-call logs; it does not audit the LLM prompts/completions around those calls. LLM-quality signals (token entropy, refusal detection, hallucination markers) are separate instruments.
4. **Twelve-call sessions.** Real agent sessions can run hundreds of calls. The cascading-failures slope detector needs enough calls for a window to be meaningful — we tested down to 6-call minimum. Sub-6-call sessions should use a simpler error-rate gate.

---

## 5. Reproducibility

```bash
cd contrarianAI/tools/tool-call-grader
npm install
npm run experiment
```

Produces `sim/agent-cascade/results/{summary.txt,results.json}`. All scenarios are hand-coded and deterministic.

---

## 6. Composition

`audit.domain.stats` matches context-inspector. A stream of session audits can be fed to the predictor-corrector to monitor multi-session trajectories — e.g., "is our agent's session health degrading across weeks?"

Pipe shape:
```
agent session → tool-call log → tool-call-grader → predictor-corrector → dashboard
```

---

## 7. Recommended screenshots

| ID | Caption | Data |
|---|---|---|
| Fig. 1 | "Pathology detection grid" — 7 scenarios × 6 pathology kinds; green=expected+fired, yellow=expected cofire, blank=did not fire | `results.json → scenarios[].fired` |
| Fig. 2 | "Health score vs pathology severity" — scatter plot; healthy scenarios in one cluster, each failure class in a labelled cluster | health + max-severity per scenario |
| Fig. 3 | "Tool-call relevance distribution (healthy vs irrelevant)" — overlay histogram showing the two workflows' relevance bell curves | `scenarios[].stats.histogram` |

Fig. 1 is the single most informative chart for the headline finding.

---

## 8. Placement in the program

- **Unseen Tide** → context-window monotonic drift; forecaster leads by 17 turns.
- **Conversation Rot** → oscillating context drift; static-σ wins.
- **RAG Needle** → retrieval pathology detection; r = 0.999 to precision@5.
- **Agent Cascade** (this paper) → multi-agent tool-call pathology detection; 7/7 on benchmark.

Next: a longitudinal multi-agent experiment feeding tool-call-grader outputs into predictor-corrector to test temporal drift detection across sessions.

---

*Authored for contrarianAI. Companion software: [`tools/tool-call-grader`](../). Prior experiments: [Unseen Tide](../../predictor-corrector/docs/whitepaper-unseen-tide.md), [Conversation Rot](../../predictor-corrector/docs/whitepaper-conversation-rot.md), [RAG Needle](../../retrieval-auditor/docs/whitepaper-rag-needle.md).*
