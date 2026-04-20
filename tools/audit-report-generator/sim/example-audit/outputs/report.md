# Bell Tuning Audit — Acme Corp Live Agent

**Client:** Acme Corp  
**Prepared by:** contrarianAI  
**Date:** 2026-04-19

---

## Executive Summary

**Audit date:** 2026-04-19

**Overall health:** 🟠 contamination (0.41 / 1.00)  

**Regime:** contamination

**Pathologies found:** 3


### Inputs audited
- **Context Window (context-inspector)** — 24 chunks
- **Retrieval Quality (retrieval-auditor)** — 5 chunks audited
- **Multi-Agent Tool Calls (tool-call-grader)** — 16 tool calls
- **Trajectory Forecast (predictor-corrector)** — history length 22

### Top findings
1. **SCHEMA_DRIFT** (sev 1.00, source: toolCallGrader) — rate of structured responses falls across the session — tool returning malformed outputs
2. **SILENT_FAILURE** (sev 0.50, source: toolCallGrader) — tool-calls errored and the agent continued without acknowledgement
3. **CASCADING_FAILURES** (sev 0.41, source: toolCallGrader) — error rate grows monotonically — the workflow is destabilising rather than hitting transient issues

### Recommended actions
1. Enforce schema validation on tool outputs; reject non-conforming responses.
2. Enforce explicit error propagation from tools to the orchestrator.
3. Add circuit-breaker on repeated failures; halt agent session and escalate.

## Context Window Analysis

Bell-curve statistics over the current context-window chunks.

| Metric | Value |
|---|---:|
| mean alignment | 0.6729 |
| stdDev | 0.2331 |
| skewness | -0.6839 |
| kurtosis | 0.0848 |
| chunk count | 24 |

Histogram (20 bins across [0, 1]):
```
0.03  #
0.07  #
0.13  ###
0.17  ####
0.23  ######
0.28  #########
0.33  #############
0.38  ##################
0.42  #######################
0.47  ############################
0.53  #################################
0.57  #####################################
0.63  #######################################
0.68  ########################################
0.72  #######################################
0.78  ####################################
0.82  ################################
0.88  ###########################
0.93  ######################
0.97  #################
```

## Retrieval Quality

| Metric | Value |
|---|---:|
| health | 0.4100 |
| regime | contamination |
| rank-quality R | 0.8868 |
| diversity | 0.9465 |
| redundancy ratio | 0.4725 |
| score calibration R | 0.5953 |
| bimodal signal | 0.0000 |

## Multi-Agent Tool-Call Analysis

| Metric | Value |
|---|---:|
| health | 0.8567 |
| regime | healthy |
| call count | 16 |
| success rate | 0.6875 |
| structured rate | 0.6875 |
| mean relevance | 0.5668 |
| tool diversity | 0.7500 |
| tool distribution | search=4, summarize=4, verify=4, publish=4 |

### Tool-call pathologies
- **SILENT_FAILURE** (severity 0.50) — tool-calls errored and the agent continued without acknowledgement
- **SCHEMA_DRIFT** (severity 1.00) — rate of structured responses falls across the session — tool returning malformed outputs
- **CASCADING_FAILURES** (severity 0.41) — error rate grows monotonically — the workflow is destabilising rather than hitting transient issues

## Trajectory Forecast

Forecaster state reflects the predicted evolution of the context-window bell curve under healthy dynamics.

| Metric | Value |
|---|---:|
| engine | abm |
| health | 0.4200 |
| regime | contamination |
| history length | 22 |
| forecast error | 0.1800 |
| baseline distance | 0.2100 |
| Milne error (ABM only) | 0.0030 |

## Appendix — Raw Input Summary

```json
{
  "contextInspector": {
    "health": 0.6810000000000003,
    "regime": "drift",
    "pathologies": []
  },
  "retrievalAuditor": {
    "health": 0.41,
    "regime": "contamination",
    "pathologies": []
  },
  "toolCallGrader": {
    "health": 0.8566964285714286,
    "regime": "healthy",
    "pathologies": [
      {
        "kind": "SILENT_FAILURE",
        "severity": 0.5
      },
      {
        "kind": "SCHEMA_DRIFT",
        "severity": 1
      },
      {
        "kind": "CASCADING_FAILURES",
        "severity": 0.41208791208791207
      }
    ]
  },
  "predictorCorrector": {
    "health": 0.42,
    "regime": "contamination",
    "pathologies": []
  }
}
```
