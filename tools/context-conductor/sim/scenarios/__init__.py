"""Benchmark scenarios. Each module exposes a generator yielding
TurnInput records along with ground-truth labels for fault turns.

TODO: port from Node `sim/scenarios/`:
- pivot.py        — legitimate user pivot mid-conversation
- noisy_stable.py — no real changes; tests false-positive resistance
- carousel.py     — 4 topics cycled twice; tests pool reuse
- slow_creep.py   — smooth adversarial contamination; tests rot detection
                    without delta signal

Reproducibility: every scenario takes a numpy.random.Generator. Use the
same seeds the Node sweep recorded for direct parity comparison.
"""
