"""Executive driver — wires posterior + pathology_gate + selector + pool.

Whitepaper §3.0 (system overview).

TODO: port from Node `core/executive.js` (~226 lines, the largest module).

Per-turn flow:
1. Receive observation (sensor profile for current turn).
2. Update posterior over pool.
3. Run pathology gate. If not "context_fault" → keep current; return.
4. Run selector → keep | swap | spawn.
5. Apply hysteresis + minimum residency. If gates block, downgrade to keep.
6. Mutate pool accordingly.
7. Return decision + diagnostic record (for the audit-report-generator).

Public API (final shape, may evolve):
    class Executive:
        def __init__(self, sensors: SensorAdapter, config: Config | None = None): ...
        def step(self, turn_input: TurnInput) -> Decision: ...
        def snapshot(self) -> ExecutiveState: ...
"""

raise NotImplementedError("executive.py not yet ported — see TODO above")
