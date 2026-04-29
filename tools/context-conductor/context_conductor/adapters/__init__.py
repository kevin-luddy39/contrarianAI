"""Runtime adapters — let context-conductor work with any agent framework.

Each adapter exposes the same SensorAdapter protocol and a lightweight
hook surface. Implementation-agnostic by design: the conductor's executive
never imports a specific framework.
"""
