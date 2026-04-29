"""Single-seed runner for benchmark scenarios.

TODO: port from Node `sim/runner.js` (~225 lines). Drives a scenario
forward turn by turn, applies each policy (naive-threshold,
context-conductor, oracle), records decisions, and emits per-turn
metrics (TPR/FPR/precision, swap counts, residency stats).

Validation gate: outputs must match Node runner's JSON dump for the same
scenario + seed within Monte Carlo noise.
"""

raise NotImplementedError("sim/runner.py not yet ported")
