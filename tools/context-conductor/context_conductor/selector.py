"""Selector — given a context_fault classification, choose action.

Whitepaper §3.4.

TODO: port from Node `core/selector.js` (~71 lines).

Decision: keep | swap_to(id) | spawn

Algorithm:
1. Compute posterior margin: best_alt_posterior / current_posterior.
2. If margin < POSTERIOR_BAYES_FACTOR → keep.
3. If best_alt_score = fitness - λ·cost < SPAWN_FLOOR → spawn (saved pool too stale).
4. Else swap_to(best_alt_id).
"""

raise NotImplementedError("selector.py not yet ported — see TODO above")
