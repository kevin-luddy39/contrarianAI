# LinkedIn Post: Context Inspector — Leading Indicator of AI System Decay

## Post Text (copy-paste below the line)

---

**Your AI system is failing 3 steps before you notice.**

I built a tool that watches the internal structure of an AI's context — not the output, the context — and it caught something that should concern anyone running AI in production.

I ran an experiment. I gave an AI the story of The Three Little Pigs and asked it to extract the lessons learned. It scored 0.85 alignment with the accepted morals. Then I started adding unrelated content — Cinderella, Columbus, the Alamo — one chapter at a time, with a tight context window that forces the system to drop old content and resummarize.

Here's what happened at the critical moment:

Step 10 (full story loaded): σ = 0.225. Bell curve tight and right-shifted. System healthy. [Screenshot 1]

Step 11 (first contamination): σ SPIKES to 0.351 — a 56% jump in one step. But the output? Judge score: 0.85. Still passing. [Screenshot 2]

Steps 12-14: σ is falling — 0.290, 0.269, 0.248. The bell curve is collapsing toward flat. But the output still scores 0.75. Still passing. Every output evaluation says "looks good." [Screenshot 3]

Step 15: σ crashes to 0.053. Judge score: 0.00. Total failure. The original story is gone from the context. The system produces zero correct lessons from this point forward and never recovers. [Screenshot 4]

The output evaluation caught the failure at step 15. The bell curve caught it at step 11.

That's 3 steps where the context was visibly degrading — the graph was screaming — while the output still looked fine. Three steps where a human reviewing the answers would have said "good enough." Three steps where the structural foundation was crumbling underneath correct-looking results.

This is what context rot looks like in production AI systems:

→ The output passes evaluation
→ The context is losing information
→ One more summarization, one more eviction, one more turn
→ Sudden, total failure with no recovery

If you're evaluating AI by checking the output, you're seeing the lagging indicator. The leading indicator is the shape of the content distribution inside the context window.

We built a tool that shows this in real time. It measures domain alignment of every chunk against a fixed reference, plots the bell curve, tracks σ over time, and flags when the structural health of the context is degrading faster than the output quality.

The tool is called Context Inspector. It's open source and MCP-aware — drops into any AI workflow as a diagnostic layer.

Questions about whether your AI stack has context rot? Start here:
https://contrarianai-landing.onrender.com/assessment.html

Or request the full AI Production Diagnostic:
https://contrarianai-landing.onrender.com/

#AI #ContextRot #AIEngineering #ProductionAI #LLM #ContextWindow #AIFailure #LeadingIndicator

---

## Screenshots to Capture

Open the dashboard (either localhost:4001 → Context Rot tab, or the context_rot_dashboard.html file on Desktop).

Select **The Three Little Pigs** run.

### Screenshot 1: "System healthy" — Step 10
- Set step slider to **10**
- Capture: the **bell curve** showing the tight right-shifted distribution
- Stats visible: σ=0.225, judge=0.85
- What it shows: chunks cluster at 0.5-0.9 on the x-axis, rug plot dots grouped right, narrow σ bands
- **Caption**: "Step 10: Full story loaded. Bell curve right-shifted, σ=0.225. System is healthy."

### Screenshot 2: "The spike nobody sees" — Step 11
- Set step slider to **11**
- Capture: the **Domain σ time-series chart** showing the sharp spike from 0.225 to 0.351
- Also capture: the **Lessons Alignment Score chart** showing judge still at 0.85
- What it shows: the σ line spikes UP while the judge line stays flat. The graph sees it. The output doesn't.
- **Caption**: "Step 11: σ jumps 56% in one step. Output still scores 0.85. The graph caught it. The output didn't."

### Screenshot 3: "Three steps of warning" — Step 14
- Set step slider to **14**
- Capture: the **full dashboard view** showing all charts at step 14
- What it shows: σ has been falling (0.351 → 0.290 → 0.269 → 0.248), judge is 0.75 (still passing), bell curve is wider and shifting left
- **Caption**: "Steps 12-14: σ declining toward collapse. Output still passes (judge=0.75). This is the warning window."

### Screenshot 4: "Total failure" — Step 15
- Set step slider to **15**
- Capture: the **bell curve** — it should be nearly flat, clustered at the left (near zero)
- Also capture: the **score chart** showing the judge line dropping from 0.75 to 0.00
- What it shows: σ=0.053, bell curve collapsed, all chunks score near 0 against the original story terms
- **Caption**: "Step 15: σ collapses to 0.053. Judge hits 0.00. The original story is gone. No recovery."

### Screenshot 5: "The full trajectory" — Step 40
- Set step slider to **40** (or just show the full charts zoomed out)
- Capture: the **Domain σ chart** and **Lessons Alignment Score chart** side by side showing all 40 steps
- What it shows: σ spiked once, then flatlined near zero. Judge went from 0.85 to 0.00 and never recovered. 6 ROT events (red dots).
- **Caption**: "40 steps. 6 context evictions. The bell curve went flat at step 15 and stayed flat. Output evaluation only caught it when it was already too late."

### Bonus: "The context text" — Step 10 vs Step 15
- Capture the **Full Context Text** panel at step 10 (original Three Little Pigs story intact)
- Capture the **Full Context Text** panel at step 15 (a compressed summary with Cinderella mixed in, original story destroyed)
- **Caption**: "Left: what the system had at step 10. Right: what's left at step 15 after one eviction and one resummarization. The pig is gone."

---

## Key narrative beats for the post:

1. **The hook**: "Your AI is failing 3 steps before you notice" — specific, falsifiable, attention-grabbing
2. **The experiment**: nursery rhymes make it accessible and concrete (not abstract "enterprise AI")
3. **The data table** (steps 10-15): shows the EXACT moment the graph diverges from the output — this is the money shot
4. **The insight**: output evaluation is a lagging indicator, context structure is a leading indicator
5. **The analogy to production**: this is what happens with RAG, multi-turn, and long-context systems — context degrades invisibly until sudden failure
6. **The tool**: Context Inspector, open source, MCP-aware
7. **The CTA**: self-assessment + diagnostic
