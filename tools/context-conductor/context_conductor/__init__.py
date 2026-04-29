"""context-conductor — Bayesian context routing for agent workflows.

Public API surfaces only the executive driver and config. Internal modules
(posterior, pool, selector, pathology_gate) are exposed for testing but
should not be imported directly by user code.
"""

from context_conductor import config

__all__ = ["config"]
__version__ = "0.1.0a0"
