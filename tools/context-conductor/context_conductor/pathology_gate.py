"""Pathology gate — 4-sensor triage tree.

Whitepaper §3.3. Decides whether a deviation observed by the posterior
should be attributed to a context fault (→ swap candidate) or to a
sensor-domain pathology (→ no swap; route to remediation specific to that
sensor).

TODO: port from Node `core/pathology-gate.js` (~59 lines).

Decision shape:
    classify(obs, sensor_signals) -> Literal[
        "context_fault",          # swap candidate
        "retrieval_pathology",    # retrieval-auditor flagged; do not swap
        "tool_call_pathology",    # tool-call-grader flagged; do not swap
        "forecast_pathology",     # predictor-corrector flagged; do not swap
        "transient_noise",        # below sustained-drift gate
    ]

Gates applied in order:
1. Cold-start (turn < COLD_START_TURNS) → "transient_noise"
2. Any sensor pathology severity ≥ PATHOLOGY_SEVERITY_FLOOR → that pathology
3. Sustained drift over SUSTAINED_DRIFT_TURNS turns → "context_fault"
4. Persistent low fitness (< PERSISTENT_LOW_FLOOR for PERSISTENT_LOW_TURNS) → "context_fault"
5. Else → "transient_noise"
"""

raise NotImplementedError("pathology_gate.py not yet ported — see TODO above")
