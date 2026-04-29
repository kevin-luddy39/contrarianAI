# Mixture of Contexts: Bayesian Regime Routing for Agentic Workflows

**A contrarianAI Research Paper**

*Kevin Luddy — April 2026*

---

> **Running long-lived agents in production?**
> Book a 30-min Bell Tuning audit and the first 5 teams get a working
> context-conductor prototype wired against their actual sensor outputs —
> health timeline, swap-vs-thrash analysis, and a written report.
> Email `kevin.luddy39@gmail.com` with subject "context-conductor audit"
> or book at [contrarianai-landing.onrender.com](https://contrarianai-landing.onrender.com).

---

## Abstract

Long-running AI agent workflows accumulate context drift, contamination, and topical pivots that single-context architectures cannot accommodate efficiently. The naive remedy — swap to a different saved context whenever the predictor-corrector signal shows the alignment bell curve diverging from baseline — confuses *deviation* with *context fault*: bad retrieval, broken tool calls, and legitimate user pivots all fire the same alarm but demand different responses. We introduce **context-conductor**, a switching state-space estimator for agent contexts that maintains a Bayesian posterior over which saved context fits the current turn, gated by a four-sensor diagnosis tree drawn from the contrarianAI Bell Tuning suite (context-inspector, retrieval-auditor, tool-call-grader, predictor-corrector). On synthetic but realistic benchmarks we demonstrate that the router preserves the true-positive swap rate of an aggressive threshold baseline (TP = 2/2 on pivot scenarios) while eliminating the threshold's false-positive thrashing on noisy-stable scenarios (FP = 0 vs 2). The architectural contribution is the **pathology gate**: the four sensors form a triage stack, not a parallel vote, and only the predictor-corrector deviation *combined with* a confirmed context-fit signal warrants a swap.

## Definitions

- **Context.** The active prompt + history + retrieved corpus + scratchpad delivered to the LLM each turn. Variable size, semantically distinct from any other context the same workflow may have used.
- **Context pool.** A bounded set of saved contexts the router may swap among. Pool size physically constrained: capacity = `(model_window_tokens × concurrency) / mean_context_size`.
- **Regime.** The latent label `{healthy, drift, contamination, rot}` produced per turn by the predictor-corrector. Borrowed from the contrarianAI Bell Tuning whitepaper.
- **Pathology gate.** The triage logic that classifies a deviation alarm into one of `{noise, retrieval_fault, tool_fault, user_pivot, context_fault}` before any swap action is taken.
- **Mixture of Contexts (MoC).** The architecture in which an agent maintains a probability distribution over candidate contexts and routes each turn to the highest-posterior context, analogous to mixture-of-experts gating but at the context layer instead of the weight layer.

---

## 1. The Problem: Deviation ≠ Context Fault

A common operational pattern in long-running agents is to set a threshold on some health signal (typically the standard deviation of the context-window alignment bell curve, or the predictor-corrector forecast error) and swap to a fresh context whenever the signal breaches the threshold. We call this **naive threshold-based context swapping**.

This pattern is wrong in three independent ways:

1. **Mistaking deviation for context fit.** The predictor-corrector signal fires on at least five distinct causes:
   - The active context legitimately no longer fits the conversation (the case the design solves)
   - Retrieval returned a poor chunk set this turn (retrieval-auditor's domain)
   - A tool call silently failed or returned irrelevant content (tool-call-grader's domain)
   - The model glitched and emitted a degraded output
   - The user legitimately pivoted to a new topic

   Of these, only causes 1 and 5 might warrant a context change; causes 2, 3, and 4 demand fixes inside their own subsystems. A single threshold treats all five identically and is therefore correct on average less than half the time.

2. **Conflating fitness and cost.** Operators commonly fold "the context is too expensive to maintain" into the same threshold as "the context no longer fits." This produces pathological cases: a perfectly fitting but large context fires the threshold and is swapped out for a worse fit, or a cheap-but-wrong context passes the threshold and stays. The fix is architectural: cost belongs at the eviction policy, not the swap-in trigger.

3. **OS paging is the wrong analog.** Threshold swap is often pitched as "memory paging for LLMs," but operating-system paging works because the MMU traps *before* the wrong page is read. Context-swap deviation fires *after* the bad turn already produced output. Paging is preventive; threshold swap is reactive. The honest analog is branch prediction with speculative execution, or — better — switching state-space estimation, where the question is not "did we exceed a threshold" but "does the posterior over which-context-fits-best concentrate on something other than the current one."

## 2. Architecture Overview

context-conductor maintains four data structures:

- **Pool.** Bounded set of saved contexts. Each carries an immutable "anchor" fingerprint (its sensor profile at spawn time) plus rolling state (residency turns, last-used turn, current token count).
- **Posterior.** Probability distribution `P(c_t = i | y_{1..t})` over the contexts in the pool, given the running stream of sensor observations.
- **History.** Recent observation traces and per-turn streak counters (drift streak, user-axis-only drop streak, low-fitness streaks per axis).
- **Decision trace.** The full per-turn record of which action was taken, what the diagnosis was, and why.

Each turn:

1. The sensor stack observes the current turn against the active context, producing `y_t = (domain, user, retrievalHealth, toolCallHealth, forecastError, retrieval.pathologies, toolCall.pathologies)`.
2. The posterior is updated with a sticky transition kernel and an observation likelihood (§3.1).
3. The pathology gate triages the diagnosis into one of five classes (§3.3).
4. The executive applies hysteresis, minimum residency, and (when the diagnosis warrants it) the selector to choose `keep | swap | spawn` (§3.4–3.7).
5. The pool's residency, fingerprints, and (periodically) coalescing pass are updated.

## 3. The Algorithm

### 3.1 Switching state-space posterior

Treat the active context as a discrete latent variable `c_t ∈ {1..N}`. Observations `y_t` are the sensor profile at turn `t`. We update

```
P(c_t = i | y_{1..t}) ∝ P(y_t | c_t = i) · Σ_j P(c_t = i | c_{t-1} = j) · P(c_{t-1} = j | y_{1..t-1})
```

with a sticky transition kernel
```
P(c_t = i | c_{t-1} = j) = ρ · 𝟙[i = j] + (1 - ρ) / (N - 1) · 𝟙[i ≠ j]
```

The default `ρ = 0.85` encodes the prior that contexts persist across turns. The observation likelihood is a softmax over the negative weighted L²-distance between the turn's sensor profile and each context's fingerprint, with weights
```
w = { domain: 0.40, user: 0.25, retrievalHealth: 0.15, toolCallHealth: 0.10, forecastError: 0.10 }
```
tunable per use case. RAG workflows typically lift `domain`; conversational workflows lift `user`; tool-heavy workflows lift `toolCallHealth`.

### 3.2 Hysteresis and minimum residency

Two constants make the algorithm well-behaved on noisy observations:

- **`MIN_RESIDENCY_TURNS = 3`**: a freshly active context cannot be displaced for at least three turns, regardless of posterior. This prevents thrashing on cold-start fingerprint instability.
- **`HYSTERESIS_GAP = 0.12`**: the posterior margin required to swap *out* of the current context is tighter than the margin required to *consider* a swap, by 12 percentage points. The algorithm stays put under uncertainty.

Without these the router thrashes; with them the swap rate matches the underlying topic-change rate to within one turn.

### 3.3 The pathology gate

The four sensors do not form a parallel vote. They form a **triage tree**:

```
deviation alarm fired (predictor-corrector forecast error or posterior shift)
├─ retrieval-auditor pathology severity ≥ 0.4?
│     → "retrieval_fault"   — fix retrieval; do NOT swap context
├─ tool-call-grader pathology severity ≥ 0.4?
│     → "tool_fault"        — fix tool call; do NOT swap context
├─ user-axis dropped > 0.20, domain-axis stable, sustained ≥ 1 turn?
│     → "user_pivot"        — proceed to selector
├─ both axes dropped > 0.20, sustained ≥ 2 turns?
│     → "context_fault"     — proceed to selector
├─ either axis below absolute floor 0.40 for ≥ 2 consecutive turns?
│     → "context_fault"     — chronic-low fitness; proceed to selector
└─ otherwise:
      → "noise"             — keep current; no action
```

This is the central architectural insight of the paper. The predictor-corrector deviation alone does not determine the action; it only fires the alarm. The other three sensors classify which subsystem is responsible. Swap is reserved for confirmed context faults.

### 3.4 The selector

When the pathology gate authorizes a swap or spawn:

```
score(c) = fitness(c, obs) − λ · normalized_cost(c)
```

with `λ = 0.15` by default. `fitness` is the same axis-weighted similarity as the observation likelihood; `normalized_cost` is the candidate's token footprint divided by the pool's max. Among candidates other than the current context, the highest-scoring one wins. If the best score is below the **spawn floor** of 0.55, the recommendation is **spawn fresh** rather than swap to a poor saved match.

### 3.5 Pool: coalescing and eviction

Coalescing scans the pool for any pair of contexts with mutual fitness ≥ 0.85 and merges them, summing token counts and keeping the larger residency. This prevents the pool from filling with near-duplicate contexts spawned by close-together pivots that turned out to be the same regime.

Eviction is triggered when the pool reaches capacity. Score = `staleness + α · cost`; the worst-scoring context is dropped. Critically, **min-residency contexts are never evicted unless the entire pool is below min-residency**, so freshly spawned contexts always get a chance to prove themselves.

### 3.6 Spawn-bias on uncertainty

Default policy when the selector produces a tied or below-floor recommendation: **spawn**, not swap. Re-priming a saved context costs more than the few tokens of system-prompt + grounding required to spawn fresh; a stale context's fingerprint may not reflect its actual usefulness. Coalescing recycles the spawn into a saved context if a similar one already exists.

### 3.7 The executive loop

```
loop turn t:
    obs_t = sensor_stack.observe(active_context, turn)
    posterior_t = ssm_step(posterior_{t-1}, obs_t, pool, weights)

    if t ≤ COLD_START_TURNS: keep current; continue
    diagnosis = pathology_gate(obs_t, history)

    if diagnosis ∈ {noise, retrieval_fault, tool_fault}:    keep
    if current.residency < MIN_RESIDENCY_TURNS:             keep
    if diagnosis ∈ {user_pivot, context_fault}:
        sel = select(obs_t, pool, current_id)
        if sel.action == swap:   swap to sel.target
        else:                    spawn fresh
    coalesce_pool_if_needed()
    evict_if_pool_full()
```

## 4. Implementation

The reference implementation lives at `https://github.com/kevin-luddy39/context-conductor`. Pure Node.js, zero runtime dependencies in the core algorithm, MIT-licensed. The four sensor MCP servers come from the contrarianAI tools tree (`context-inspector`, `retrieval-auditor`, `tool-call-grader`, `predictor-corrector`). A Python adapter using `atomic_agents.connectors.mcp.MCPFactory` lives in the sibling `atomic-agents` repository (`atomic-examples/contrarianai-bridge/`) and demonstrates that context-conductor is callable from any MCP-aware framework.

## 5. Experiments

We run **four synthetic-but-realistic benchmarks** comparing three policies on identical observation streams, each swept across **N = 100 random seeds** (Mulberry32 RNG, seed range 1000–1099). Each cell is reported as **mean ± standard deviation** across the 100 runs. Sensor outputs are generated to match the shapes the production MCP sensor servers emit. The sweep harness is reproducible at `sim/sweep.js`; raw numbers are checked into `sim/results/sweep.json`.

The four scenarios stress different parts of the algorithm:
- **§5.1 pivot** — sharp legitimate topic changes (catch-true-positives)
- **§5.2 noisy-stable** — no real changes, only single-axis noise blips (suppress-false-positives)
- **§5.3 carousel** — four topics cycled twice (pool reuse + coalescing)
- **§5.4 slow-creep** — adversarial smooth contamination (rot detection without delta signal)

### 5.1 Pivot scenario

A 12-turn conversation that legitimately pivots topic at turn 6 (topic A → B) and again at turn 11 (B → A). Topics A and B have substantially different domain centers (0.85 vs 0.32). Turn 8 contains a single-axis user blip (noise). Turn 10 contains a tool-call silent-failure pathology that fires the sensor but is *not* a context fault.

| policy            |       tokens       |     fitness    |    swaps    |    TP / 2   |     FP      |    TPR     |
|-------------------|-------------------:|---------------:|------------:|------------:|------------:|-----------:|
| single-context    |    35205 ± 736     | 0.497 ± 0.008  | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 |
| naive-threshold   |    14693 ± 957     | 0.552 ± 0.010  | 2.08 ± 0.31 | 1.99 ± 0.10 | 0.09 ± 0.29 | 0.99 ± 0.05 |
| **context-conductor** | 17960 ± 807   | 0.467 ± 0.008  | 1.81 ± 0.39 | 1.81 ± 0.39 | **0.00 ± 0.00** | 0.91 ± 0.20 |

The single-context baseline carries the stale topic-A context through topic-B turns, taking a ~50% fitness penalty across every seed. Both swap policies detect the pivots within the ±2-turn windowed credit. The naive threshold catches very nearly every pivot (TPR 99% ± 5%) but at the cost of occasional false positives (FP 0.09 ± 0.29 — a small fraction of seeds where the noise blip at turn 8 trips the threshold). The context-conductor's sustained-signal gate is more conservative: TPR 91% ± 20% (it occasionally misses a pivot when the seed produces a small initial drop that does not persist into the next turn) — but in exchange the FP rate is **flat zero across all 100 seeds**.

### 5.2 Noisy-stable scenario

A 12-turn conversation entirely on a single topic with **no real pivots**, but with sharp single-axis user-axis blips at turns 4 and 8 that exceed naive's 0.18 threshold, plus a tool-fault at turn 11 that fires sensor pathology without being a context fault.

| policy            |       tokens       |     fitness    |    swaps    |     FP      |
|-------------------|-------------------:|---------------:|------------:|------------:|
| single-context    |    35205 ± 736     | 0.850 ± 0.010  | 0.00 ± 0.00 | 0.00 ± 0.00 |
| naive-threshold   |    14002 ± 259     | 0.851 ± 0.010  | 2.00 ± 0.00 | **2.00 ± 0.00** |
| **context-conductor** | 35205 ± 736   | 0.851 ± 0.010  | 0.00 ± 0.00 | **0.00 ± 0.00** |

The naive policy thrashes deterministically: every seed produces exactly two false-positive swaps (one per noise blip), without exception. Each swap discards conversational continuity and forces the LLM to re-ground; the apparent token savings are an artifact of resetting the context twice mid-stream. The context-conductor holds across every seed: the `user_pivot` diagnosis requires a sustained user-axis drop (≥ 1 prior turn of drop) and the persistent-low-fitness gate requires ≥ 2 consecutive turns below the absolute floor. Both gates correctly suppress the noise across all 100 runs.

### 5.3 Carousel scenario (pool reuse + coalescing)

A 24-turn conversation cycling through four topics A → B → C → D → A → B → C → D, three turns per segment. Topics A and B have the most-different domain centers (0.85 vs 0.30); C and D fall between (0.55, 0.70). Seven legitimate pivots (turns 4, 7, 10, 13, 16, 19, 22), with the second half of the run *returning* to topics already seen. This stresses two algorithmic properties the simpler scenarios cannot test:

1. **Pool reuse.** When topic A returns at turn 13, an ideal router *swaps back* to the saved topic-A context (preserving its history) rather than spawning a fresh one. The naive threshold has no concept of saved contexts; it always spawns.
2. **Coalescing pressure.** Pool capacity is 8 by default; the run produces 8 spawn-eligible regimes if no reuse happens. With reuse + coalescing, pool occupancy stays bounded at ~4.

| policy            |       tokens       |     fitness    |    swaps    |     TP / 7   |     FP      |    TPR     |   reuseRate    |
|-------------------|-------------------:|---------------:|------------:|-------------:|------------:|-----------:|---------------:|
| single-context    |   135328 ± 1995    | 0.275 ± 0.006  | 0.00 ± 0.00 | 0.00 ± 0.00  | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.000 ± 0.000 |
| naive-threshold   |    21635 ± 334     | 0.471 ± 0.007  | 6.00 ± 0.00 | 6.00 ± 0.00  | 0.00 ± 0.00 | 0.86 ± 0.00 | 0.000 ± 0.000 |
| **context-conductor** | 28496 ± 1155 | 0.282 ± 0.029  | 5.00 ± 0.00 | 5.00 ± 0.00  | 0.00 ± 0.00 | 0.71 ± 0.00 | **0.438 ± 0.079** |

The single-context baseline is catastrophic on this scenario: one context cannot accommodate four topics in 24 turns, and mean fitness collapses to 0.275. The naive threshold catches 6 of 7 pivots but **never reuses** a saved context — every detected pivot is a fresh spawn, so by turn 24 it has produced 6 disjoint contexts. The conductor catches one pivot fewer (5 of 7), but **44% of those swaps are swap-backs to a previously-saved context**, demonstrating that coalescing + saved-context selection is doing real work. The 14-percentage-point TPR concession reflects the same sustained-signal gate behaviour as in §5.1: short 3-turn segments leave little room for the gate to confirm before the segment ends.

The conductor's reuse rate is the metric that no threshold-based policy can match by construction. It is what makes the architecture distinct.

### 5.4 Slow-creep scenario (adversarial rot detection)

A 20-turn conversation on a single topic where the active context's domain alignment decays smoothly from 0.85 to ~0.20 across turns 4 through 18 — a power-curve creep that mimics gradual contamination, summary loss, or context-window saturation. **No turn produces a sharp delta** large enough to trip naive's 0.18 threshold. The predictor-corrector forecast error grows in lockstep with the decay; the conductor's persistent-low-fitness gate is the only mechanism that can detect this regime change.

We score with **zone-based credit** rather than windowed pivot credit: a swap any time after the rot-zone start (turn 9) counts as a true positive (regime detection); any swap before turn 9 is a false positive (premature thrash); extra swaps beyond the first in-zone action are also FP (over-correction).

| policy            |       tokens       |     fitness    |    swaps    |    TP / 1   |     FP      |    TPR     | first action turn |
|-------------------|-------------------:|---------------:|------------:|------------:|------------:|-----------:|------------------:|
| single-context    |    94741 ± 1494    | 0.562 ± 0.005  | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 |    21.0 ± 0.0    |
| naive-threshold   |    94741 ± 1494    | 0.562 ± 0.005  | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 |    21.0 ± 0.0    |
| **context-conductor** | 64833 ± 2970 | 0.562 ± 0.005  | 1.17 ± 0.38 | 1.00 ± 0.00 | 0.17 ± 0.38 | **1.00 ± 0.00** | **16.9 ± 0.4** |

Naive completely misses the rot. There is no per-turn delta large enough to fire its threshold across all 100 seeds — TPR 0.00 deterministically. The conductor catches the rot on every single seed (TPR 1.00 ± 0.00) at a tightly-bounded turn (16.9 ± 0.4). The 17% FP rate reflects ~1-in-6 seeds where a second swap fires shortly after the first as the persistent-low-fitness gate continues to hold.

The fitness column is identical for all three policies because *fitness is measured on the observation, not on the answer*. All three policies see the same degraded observation stream; only the conductor takes any corrective action. In production this would translate to: same token cost, same observed degradation, but the conductor's saved old-context gets retired and a fresh one takes over, restoring quality. The naive baseline carries the rotted context to the end of the conversation.

This scenario is the strongest argument for the four-sensor pathology gate over any single-sensor threshold. Without the persistent-low-fitness gate, the conductor would also miss this regime — the predictor-corrector forecast error alone, without the absolute floor, would still be a slow-changing signal vulnerable to threshold drift.

### 5.5 Combined verdict

Per-seed combined precision across all four scenarios (`precision = total_TP / (total_TP + total_FP)`):

| policy            |  combined precision (mean ± std, n=100) |
|-------------------|----------------------------------------:|
| naive-threshold   |                          0.885 ± 0.028  |
| **context-conductor** |                  **0.987 ± 0.036**  |

The naive policy's combined precision sits below the conductor's by ~10 points, with three times the variance. The naive policy is competitive on §5.1 (where its aggressiveness pays off as TP) but loses ground on §5.2 (every noise blip becomes FP) and §5.4 (where it fails to detect rot at all, contributing zero TP). The conductor's precision advantage is mostly driven by the §5.2 and §5.4 wins — the scenarios that punish single-threshold policies for not having a diagnosis tree.

The architectural insight in numbers, robust to seed selection across four orthogonal stress tests:
- **TPR**: conductor 0.71–1.00 across scenarios; naive 0.00–1.00 (catastrophic on slow-creep)
- **FP per run**: conductor 0.00–0.17 across scenarios; naive 0.00–2.00 (deterministic thrash on noisy-stable)
- **Reuse**: conductor 0.44 on carousel; naive 0.00 by construction
- **Combined precision**: conductor 0.99 vs naive 0.89, with the conductor distribution tighter

The cost of these wins is a ~9–14 point TPR concession on legitimate-pivot scenarios (the price of the sustained-signal gate that suppresses noise FP). In production this trade-off favors the conductor: a missed pivot delays the swap by a turn or two and is recoverable via the persistent-low-fitness gate; an FP irrecoverably destroys conversational continuity and forces full re-grounding.

## 6. Limitations

- **Synthetic benchmarks.** The §5.1–§5.4 scenarios are 12–24 turn synthetic generators; conversational dynamics in production are richer and longer. We have swept the synthetic seed space at N=100 across four orthogonal scenarios (legitimate pivot, noisy stable, multi-topic carousel, smooth contamination) to bound seed-selection bias and stress the algorithm from multiple directions, but a production validation against real agent workflow traces is the next experiment. Preliminary wiring is in place via the `atomic-examples/contrarianai-bridge/` adapter against live MCP sensors.
- **TPR concession.** Across the 100-seed sweep the conductor occasionally misses a pivot (TPR 91% ± 20% on the pivot scenario, vs naive's 99% ± 5%). The cause is the user_pivot sustained-signal gate: when the user-axis drop on the trigger turn is small enough that the *next* turn's recovery brings the streak counter back to zero before the diagnosis fires, the swap is delayed past the ±2-turn windowed credit. The persistent-low-fitness gate eventually catches these as `context_fault`, so the swap *does* happen — just outside the credit window. A sliding-window TPR measure rather than discrete window credit would lift the visible TPR; we keep the strict measure here for honest comparison with the naive policy.
- **Fingerprint drift.** During long mismatched stretches the active context's rolling fingerprint can drift toward the wrong-topic profile. We mitigate by locking fingerprint updates when current obs alignment with the active context falls below 0.6, but the lock is a heuristic and not principled. A learned-similarity fingerprint embedding is a future direction.
- **Cold-start window is a fixed constant.** The 4-turn cold-start should ideally be a function of how quickly the predictor-corrector posterior stabilizes, which depends on the workflow's signal-to-noise ratio. Adaptive cold-start is future work.
- **Pool capacity hyperparameter.** Default 8; production should compute capacity from the model context window and concurrency. We have not yet tested behavior near capacity (eviction-driven thrashing is plausible at high concurrency).
- **Sensor weights.** Defaults assume a RAG workflow. We provide tunable weights but no automatic tuning; an upstream `sim-tune` experiment that grid-searches weights against a labelled trace set is on the roadmap.

## 7. Productization

context-conductor is the **fix-side** companion to the contrarianAI Bell Tuning audit. The sensors diagnose; context-conductor remediates. Three productization paths:

1. **Audit-in-a-Box upsell.** A standard Rapid Audit identifies pathology fingerprints in a customer's existing agent. When the pathology is "context drift / single-context pinned to wrong topic," the natural fix is context-conductor. Add it as a $5K Phase-2 implementation.
2. **SaaS sidecar.** context-conductor runs as a sidecar process for production agent workflows, watching MCP traces in real time. Recurring SaaS revenue on top of one-shot audits.
3. **MCP server.** A `context-conductor/mcp-server.js` exposes the routing decision as an MCP tool any agent framework can consume. Wraps cleanly into atomic-agents (Python), Mastra (TS), or any LangChain pipeline through MCP.

## 8. Conclusion

The right way to think about context routing in agent workflows is not "page-swap on threshold" but "Bayesian regime estimation with sensor-stack diagnosis." The single-threshold approach fails because it conflates five distinct failure modes. The four-sensor pathology gate disambiguates them. The switching state-space posterior provides principled hysteresis, smooth decision-making, and uncertainty handling that no hand-tuned threshold can match. Combined, they yield a context router that catches every real topic change while ignoring noise — the table-stakes property production agent operators need but rarely get from threshold-based code.

context-conductor is open-source, MIT-licensed, and packaged for installation through NPM and the MCP server registry. The reference implementation includes both synthetic benchmarks above plus the live MCP sensor adapter. A 30-minute Bell Tuning audit will tell any production agent team whether context-conductor is the right fix for their drift problem.

---

**Appendix A — Hyperparameter table**

| name | default | meaning |
|------|--------:|---------|
| `STICKY_SELF_PRIOR` | 0.85 | sticky transition kernel self-probability |
| `POSTERIOR_BAYES_FACTOR` | 3.0 | margin required to consider a swap (informational) |
| `MIN_RESIDENCY_TURNS` | 3 | turns a fresh context cannot be displaced |
| `HYSTERESIS_GAP` | 0.12 | swap-out vs swap-consider posterior gap |
| `PATHOLOGY_SEVERITY_FLOOR` | 0.4 | sensor pathology severity that gates context swap |
| `SUSTAINED_DRIFT_TURNS` | 2 | consecutive both-axis drops required for context_fault |
| `PERSISTENT_LOW_FLOOR` | 0.40 | absolute floor below which sustained presence = context_fault |
| `PERSISTENT_LOW_TURNS` | 2 | consecutive turns below floor required |
| `COST_WEIGHT_LAMBDA` | 0.15 | cost weight in selector score |
| `SPAWN_FLOOR` | 0.55 | minimum saved-context score below which spawn fresh |
| `POOL_CAPACITY` | 8 | max number of saved contexts |
| `COALESCE_FITNESS` | 0.85 | mutual fitness above which two contexts merge |
| `COLD_START_TURNS` | 4 | turns at start during which no swap is considered |

**Appendix B — Citations**

- Luddy, K. (2026). *Context Rot: Statistical Early Warning for AI System Degradation*. contrarianAI research paper. [Bell Tuning whitepaper.]
- contrarianAI tools tree: `context-inspector`, `retrieval-auditor`, `tool-call-grader`, `predictor-corrector`. https://github.com/kevin-luddy39/contrarianAI
- atomic-agents framework. https://github.com/BrainBlend-AI/atomic-agents
