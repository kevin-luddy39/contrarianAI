"""MCP sensor adapter — calls the four contrarianAI Node MCP servers
(context-inspector, retrieval-auditor, tool-call-grader, predictor-corrector)
and returns a normalized observation vector for the executive.

TODO: implement using `mcp` Python client. Spawn each Node sensor server
via stdio transport, fetch its exposed tools, route per-axis observation
queries to the right server.

Sensor → axis mapping:
    context-inspector       → domain, user
    retrieval-auditor       → retrieval_health
    tool-call-grader        → tool_call_health
    predictor-corrector     → forecast_error

Sensor server paths (relative to contrarianAI repo root):
    tools/context-inspector/mcp-server.js
    tools/retrieval-auditor/mcp-server.js
    tools/tool-call-grader/mcp-server.js
    tools/predictor-corrector/mcp-server.js

Each server is spawned by the bridge_stdio pattern proven in the
(now-deleted) atomic-agents bridge. Reuse that pattern here.
"""

raise NotImplementedError("mcp_sensors.py not yet implemented — see TODO above")
