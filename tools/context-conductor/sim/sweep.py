"""100-seed sweep harness — produces the validation table claimed in
README.md and whitepaper §5.

TODO: port from Node `sim/sweep.js` (~275 lines).

Target output (must reproduce Node within Monte Carlo noise):

    | policy            | combined precision (mean ± std, n=100) |
    |-------------------|---------------------------------------:|
    | naive-threshold   |                         0.885 ± 0.028  |
    | context-conductor |                         0.987 ± 0.036  |

Per-scenario detail must also match:
- noisy-stable: naive FP 2.0 ± 0; conductor FP 0.0 ± 0
- carousel: conductor reuse rate 44%
- slow-creep: naive TPR 0.00; conductor TPR 1.00, detected at turn 16.9 ± 0.4
"""

raise NotImplementedError("sim/sweep.py not yet ported")
