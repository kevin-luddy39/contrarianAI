"""Context pool — bounded set of saved contexts with cost-weighted eviction.

Whitepaper §3.5. Capacity bounded by
    POOL_CAPACITY ≈ (model_window_tokens × concurrency) / mean_context_tokens

TODO: port from Node `core/pool.js` (~141 lines).

Responsibilities:
- Maintain ordered set of saved contexts (id, fingerprint, residency_turns,
  spawned_at, last_used_at, token_size).
- Add new context (spawn).
- Mark context as active vs saved.
- Evict on capacity overflow: lowest score = fitness - λ·cost.
- Coalesce two stored contexts when mutual fitness ≥ COALESCE_FITNESS.
- Track residency_turns to satisfy MIN_RESIDENCY_TURNS gate.

Parity test target: tests/test_pool.py replays the Node sweep's
context-lifecycle log and asserts identical eviction/coalesce decisions.
"""

raise NotImplementedError("pool.py not yet ported — see TODO above")
