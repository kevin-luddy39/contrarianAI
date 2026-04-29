"""Raw adapter — direct OpenAI/Anthropic client integration with no
agent-framework wrapper. Intended for buyers who run thin custom loops
and want to add conductor as a per-turn gate.

TODO: implement minimal hook API:
    raw_adapter = RawAdapter(executive=Executive(...))
    decision = raw_adapter.before_turn(messages, retrieval_chunks, tool_calls)
    if decision.action == "swap":
        messages = decision.context.messages
    response = client.messages.create(messages=messages, ...)
    raw_adapter.after_turn(response)
"""

raise NotImplementedError("raw.py not yet implemented")
