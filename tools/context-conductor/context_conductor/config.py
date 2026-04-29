"""Hyperparameter defaults. Every constant traces to a section in
docs/whitepaper.md. No magic numbers in flow code; flow imports from here.

Ported verbatim from Node `core/config.js`. Values must remain in lockstep
with the Node reference until the parity sweep confirms equivalence.
"""

# Switching SSM posterior (whitepaper §3.1)
STICKY_SELF_PRIOR = 0.85
POSTERIOR_BAYES_FACTOR = 3.0

# Hysteresis + residency (whitepaper §3.2)
MIN_RESIDENCY_TURNS = 3
HYSTERESIS_GAP = 0.12

# Pathology gate (whitepaper §3.3)
PATHOLOGY_SEVERITY_FLOOR = 0.4
SUSTAINED_DRIFT_TURNS = 2
PERSISTENT_LOW_FLOOR = 0.40
PERSISTENT_LOW_TURNS = 2

# Selector (whitepaper §3.4)
COST_WEIGHT_LAMBDA = 0.15
SPAWN_FLOOR = 0.55

# Pool (whitepaper §3.5)
POOL_CAPACITY = 8
COALESCE_FITNESS = 0.85

# Cold start
COLD_START_TURNS = 4

# Sensor weights (whitepaper §3.6)
SENSOR_WEIGHTS = {
    "domain": 0.40,
    "user": 0.25,
    "retrieval_health": 0.15,
    "tool_call_health": 0.10,
    "forecast_error": 0.10,
}
