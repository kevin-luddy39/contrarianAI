# AI Production Readiness Self-Assessment

*From contrarianAI — the diagnostic version of our paid AI Risk & Readiness Audit.*

---

## How this works

Twelve questions. Each one scores **0, 1, or 2**. Answer honestly — the point is to find gaps, not defend them. Total is out of **24**.

This takes about 10 minutes if you know your stack. If a question requires "let me check" — write down "1" and come back to it later. Uncertainty is itself a finding.

---

## Part 1 — The Basics (demo vs. product)

### 1. Observability
Do you have structured logs *and* active alerting for errors in your AI pipeline?

- **0** — No structured logs, no alerts. Errors are discovered by users telling you.
- **1** — You log to stdout or a file, but nothing pages you when something breaks.
- **2** — Structured logs (JSON) + alerting on error rate, latency, and cost anomalies.

**Your score: ___**

---

### 2. Environment separation
Do you have a staging environment that mirrors production, with its own credentials?

- **0** — You deploy straight to prod. "Staging" is your laptop.
- **1** — You have a staging environment but it shares prod credentials, prod data, or prod API keys.
- **2** — Fully separated envs with distinct credentials, isolated data, distinct API keys.

**Your score: ___**

---

### 3. Secrets management
Where are your API keys, model provider tokens, and credentials stored?

- **0** — In code, committed to git, or in plaintext config files.
- **1** — In environment variables, but shared across the team via Slack/email.
- **2** — In a proper secret manager (AWS Secrets Manager, GCP Secret Manager, Vault, Render/Railway secrets) with access audited.

**Your score: ___**

---

### 4. Rate limiting
Do your public-facing and AI-calling endpoints enforce rate limits?

- **0** — No rate limiting anywhere. A single user could spike your token bill 100x in an hour.
- **1** — Some endpoints (e.g., login) are limited, but AI endpoints aren't.
- **2** — All endpoints — especially AI calls — enforce per-user and per-endpoint limits.

**Your score: ___**

---

### 5. Unhappy path testing
Have you *explicitly* tested: empty submissions, double-clicks, expired sessions, malformed inputs, timeouts mid-stream, and provider API failures?

- **0** — You've tested the happy path. "It works in the demo."
- **1** — You test some failure modes but not systematically.
- **2** — You have automated tests for each unhappy path above, and they run on every deploy.

**Your score: ___**

---

### 6. Config separation
Are your dev, staging, and prod configs distinct files with separate credentials, separate endpoints, and separate model keys?

- **0** — One config file. You change environment variables when you want to "switch" environments.
- **1** — Separate configs for dev and prod, but models/keys are the same across environments.
- **2** — Separate configs *and* separate credentials *and* separate model accounts.

**Your score: ___**

---

### 7. Error surfacing
Are errors surfaced to your logs and alerting, or do catch blocks silently swallow them?

- **0** — Silent `try/except` blocks everywhere. Users see wrong answers with no trace in logs.
- **1** — Errors are logged, but nothing alerts you when the rate spikes.
- **2** — Every caught error is logged with context *and* contributes to an error-rate alert.

**Your score: ___**

---

### 8. Cost controls
Do you track AI spend *and* enforce per-user or per-endpoint token limits?

- **0** — You find out your token bill at the end of the month.
- **1** — You track spend in a dashboard but don't enforce any limits.
- **2** — Tracking + per-user limits + billing alerts that fire *before* you blow budget.

**Your score: ___**

---

## Part 2 — The Advanced Checks (what most teams miss)

### 9. External evaluation
When your AI produces output, is it judged by something *other than the same session that produced it*?

- **0** — The AI writes the code and the same AI says "looks good." Confirmation bias with a GPU.
- **1** — Sometimes a different prompt/session evaluates, but not systematically.
- **2** — External evaluator (separate model call, deterministic test, or automated check) runs on every generation. Builder and judge are never the same entity.

**Your score: ___**

---

### 10. Session continuity
When a session ends (crash, context limit, user-initiated end), do you have a *structured handoff artifact* — not just a raw transcript — that the next session can orient on?

- **0** — Every new session starts blind. Users explain the problem all over again.
- **1** — You keep conversation history but the next session has to re-read 10K tokens to figure out what's going on.
- **2** — Structured handoff: current state, open decisions, completed work, next actions — persisted as a compact JSON/markdown artifact.

**Your score: ___**

---

### 11. Compaction resilience
When context gets summarized or compacted mid-session, do your plans, checklists, and critical constraints survive intact?

- **0** — Not thought about. Summarization destroys dollar amounts, order numbers, and the original plan.
- **1** — You've noticed the problem but haven't fixed it.
- **2** — Critical state is persisted outside the context window (file, database, external store) and re-injected on each turn. Compaction is non-destructive.

**Your score: ___**

---

### 12. Escalation logic
When your AI escalates to a human, is the trigger a *structured event* — or is it based on sentiment ("the user seems frustrated")?

- **0** — Sentiment-based. You're using the AI to guess when the AI is failing.
- **1** — Some structured triggers (e.g., retry count) but sentiment is still in the mix.
- **2** — Escalations fire on explicit structured conditions: retry exceeded, confidence below threshold, external validator failed, user explicitly requested human.

**Your score: ___**

---

## Your total score: ___ / 24

---

## What your score means

### 20–24: Production-grade
You're in the top ~5% of teams running AI in production. The paid audit will still find 3+ issues — we always do — but they'll be subtler: tool description routing, context rot patterns, semantic layer gaps. Worth doing if you're scaling past $50K/month in AI spend.

### 14–19: Mostly there, notable gaps
You have the basics right but are exposed in 3–5 specific areas. A targeted audit will recover 5–10x its cost in the first quarter, usually through cost optimization or reducing silent failure rates. This is our most common client profile.

### 8–13: Significant risk
You're running what most vendors would call a "working AI product," but it's structurally brittle. You almost certainly have active incidents you can't diagnose, high spend you can't explain, and users losing trust for reasons you can't pinpoint. The audit will find 10+ fixable issues.

### 0–7: You're shipping a prototype
Stop. Before you add features, fix the foundation. If you're generating revenue on this stack, you're running on borrowed time. The audit becomes a *mandatory* step before your next release — not a nice-to-have.

---

## If you scored under 14

Every item above is something I've seen break in production — not theoretically, but at real companies with real users losing real trust. The paid audit turns this self-assessment into a prioritized fix list with specific code/config changes, time estimates, and expected impact.

**Personal guarantee:** If I don't find at least 3 production-impacting issues in your AI stack, you don't pay. Every audit I've run so far has found more than 3.

**Request your audit:** https://contrarianai-landing.onrender.com/

---

## If you scored over 20

You don't need the full audit. You might benefit from a targeted 3–5 day engagement on whatever single dimension concerns you most — usually Token Economics, Context Rot, or Tool & MCP Configuration. DM me and we'll scope it together.

---

*contrarianAI — We find what's actually wrong with your AI before your users do.*
