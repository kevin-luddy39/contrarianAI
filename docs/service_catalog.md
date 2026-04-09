# contrarianAI — Service Catalog

Derived from 13 articles documenting the most common and costly AI implementation failures across enterprise and startup contexts.

---

## Audit Services

### 1. Agent Architecture Audit

**What it is:** Deep assessment of an organization's AI agent orchestration — loop design, multi-agent coordination, context management, tool routing, session continuity.

**What it catches:**
- Agents that parse natural language for completion instead of using `stop_reason` (Domain 1 anti-pattern)
- Subagents that assume shared memory with coordinators (silent data loss)
- Narrow decomposition failures where coordinator's plan is the root cause, not downstream agents
- Attention dilution from processing 14+ files in a single pass
- Stale context from resumed sessions with modified files
- Context anxiety — model wrapping up prematurely as context fills
- Self-evaluation bias — builder judging its own output

**Delivery:** 1-2 week engagement. Codebase review + architecture assessment + written report with prioritized fixes.

**Source articles:** Harness Engineering Playbook, Claude Architect Study Guide, Harness Reconstruction, SDLC for Agentic AI

---

### 2. Context Rot Diagnostic

**What it is:** Assessment of how an organization's AI systems manage accumulating context — detecting degradation patterns before they cause visible failures.

**What it catches:**
- Progressive summarization destroying transactional data (dollar amounts, order numbers, dates lost to summaries)
- Lost-in-the-middle effect burying critical instructions
- Context window exhaustion from verbose tool results and unscoped file reads
- Conflicting context creating agent loops, latency spikes, and confident hallucinations
- Memory/knowledge base pollution from stale, contradictory, or undated entries
- Performance degradation starting at ~147K tokens (not 200K)

**Delivery:** 1-week diagnostic. Token usage analysis + context flow mapping + remediation plan.

**Source articles:** Context Rot (The New Stack), Session Degradation Fix, Full-Stack Contextual Engineering, Claude Architect Study Guide Domain 5

---

### 3. Tool & MCP Configuration Audit

**What it is:** Review of tool descriptions, MCP server configuration, error handling, and tool distribution across agents.

**What it catches:**
- Tool description quality causing misrouted calls (the #1 silent failure in production Claude systems)
- More than 4-5 tools per agent degrading selection reliability
- Missing structured error responses (no distinction between transient/validation/business/permission errors)
- Access failure vs valid empty result confusion
- MCP config in user-level instead of project-level (new team members missing tools)
- Project-specific vs universal config confusion

**Delivery:** 3-5 day engagement. Tool inventory + description rewrite + error taxonomy + config restructuring.

**Source articles:** Claude Architect Study Guide Domain 2, n8n Architect article, 10 Claude Plugins

---

### 4. Semantic Layer / Meaning Audit

**What it is:** Assessment of whether an organization's data has the semantic clarity needed for AI to produce correct answers — the "meaning layer" between data and AI.

**What it catches:**
- Same term defined differently across teams ("revenue," "active user," "customer")
- Column names that only made sense to departed employees
- AI picking a table and giving confident, plausible, wrong answers
- Trust erosion from wrong AI answers (hardest problem to reverse)
- Missing governed context (same word should return different correct answers based on who's asking)

**Delivery:** 2-3 week engagement. Term inventory + definition mapping + conflict identification + semantic model recommendations.

**Source articles:** Enterprise AI Production Problem (Paolo Perrone)

---

## Analysis Tools

### 5. Agent-vs-Workflow Decision Framework

**What it is:** Diagnostic tool that maps an organization's automation needs against the agent/workflow/hybrid spectrum.

**Core finding:** 90% of automation is deterministic workflows wearing agent costumes. Only ~10% genuinely requires agent reasoning.

**Decision matrix:**
| Need | Solution | Coverage |
|------|----------|----------|
| Stable, repetitive processes (webhooks, CRONs, data sync) | Workflow (n8n, etc.) | ~80% |
| One-off tasks, exploration, prototypes | Claude Code / AI direct | One-off |
| Build + maintain workflows faster | AI + workflow platform (MCP) | Build layer |
| Genuinely unpredictable inputs, can't pre-map decision tree | Autonomous AI agent | ~10% |

**Delivery:** Self-service assessment tool + 1-day advisory session.

**Source articles:** n8n Architect, Anthropic Trends Report Trend 2

---

### 6. Token Economics Analyzer

**What it is:** Tool that profiles an organization's AI token usage and identifies waste.

**What it measures:**
- Real usable context (not advertised window — subtract system prompt, tool definitions, MCP schemas, memory)
- Token cost per action type (full file read ~3,000 tokens vs targeted grep ~200 tokens — 40x difference)
- Model selection efficiency (every subagent on Opus costs 40x what it needs to)
- Batch API eligibility (50% savings on latency-tolerant workflows)
- MCP server overhead (each server costs 2,000-8,000 tokens before any work)

**Delivery:** Automated profiling script + cost optimization report.

**Source articles:** Session Degradation Fix, Claude Architect Study Guide (missing domain: cost optimization)

---

### 7. Production Readiness Scorecard

**What it is:** 8-point assessment based on the demo-vs-product checklist, extended with findings from all articles.

**The 8 checks:**
1. Production visibility (structured logs, error alerts, uptime monitoring)
2. Staging environment (separate deploy targets)
3. Secret management (no API keys in code)
4. Rate limiting (on all endpoints)
5. Unhappy path testing (empty submissions, double-clicks, expired sessions)
6. Environment separation (different configs for dev/prod)
7. Error surfacing (no silent catch blocks)
8. Spend tracking (billing alerts, per-user API limits)

**Extended checks from article collection:**
9. External evaluation (builder doesn't judge own output)
10. Session continuity (structured handoff artifacts between sessions)
11. Compaction resilience (persistent checklists survive context compression)
12. Escalation logic (three valid triggers, not sentiment-based)

**Delivery:** Self-service web tool + PDF report.

**Source articles:** 8 Signs Your AI App Is a Demo, Harness Engineering Playbook, SDLC for Agentic AI, Claude Architect Study Guide

---

## Advisory Services

### 8. Harness Engineering Workshop

**What it is:** Hands-on training for engineering teams on building production harnesses around AI agents.

**Curriculum:**
- Day 1: Agent loop fundamentals, anti-patterns, hub-and-spoke orchestration
- Day 2: Harness construction — initializer agents, progress artifacts, feature tracking (JSON not Markdown), session orientation sequences
- Day 3: Generator-evaluator loops, sprint contracts, external evaluation with Playwright/Puppeteer
- Day 4: Context management — 30-minute sprint system, PreCompact hooks, session handoff patterns, compaction-resistant checklists
- Day 5: Production hardening — permission governance, event bus hooks, file snapshots, session persistence

**Delivery:** 5-day on-site or remote workshop. Teams build a working harness during the workshop.

**Source articles:** Harness Engineering Playbook, Harness Reconstruction (Fareed Khan), SDLC for Agentic AI, Session Degradation Fix

---

### 9. AI Platform Selection Advisory

**What it is:** Decision framework for choosing between self-built lean stacks vs packaged platforms.

**Default recommendation:** Start lightweight open-source. Prove value cheaply before committing to any vendor.

**Escalation triggers (2+ must apply):**
1. Scale & reliability (high concurrent usage, strict SLAs)
2. Governance & compliance (regulated industry, audit requirements)
3. Team bandwidth (limited MLOps/DevOps)
4. Complex agentic workflows (multi-agent, heavy tool use)
5. TCO crossover (self-managed ops exceed managed pricing)
6. Existing cloud footprint (Azure/AWS investment as multiplier)

**Delivery:** 2-day assessment + recommendation document + TCO comparison.

**Source articles:** AI Platform Decision Framework

---

### 10. SDLC Pipeline Design

**What it is:** Design and implementation of a structured development lifecycle for AI-assisted engineering teams.

**Pipeline:** Spec -> Architect -> Implement -> Reflect -> Multi-Agent Review -> PR Review -> Merge -> Wrapup

**Key design elements:**
- Validate-correct-revalidate loops (up to 3 attempts before human escalation)
- `/reflect` step where AI reviews its own shortcuts before moving on
- Independent review instance (not the same session that wrote the code)
- Compaction-resistant checklist persisted across pipeline steps
- Lessons learned captured and referenced in future cycles

**Delivery:** Pipeline design document + skill/command implementations + team training.

**Source articles:** SDLC for Agentic AI (Brett Luelling), Claude Architect Study Guide Domain 3
