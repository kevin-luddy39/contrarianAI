# TIER 0 — Direct-Convert Targets (2026-04-23)

NOT comment-and-hope-for-DM threads. Active hiring posts, "we need help" posts, and the single highest-leverage thread in the whole hunt. Work these BEFORE anything in `2026-04-23-reddit-hunt.md` (Tier 1-2).

Companion files:
- `2026-04-23-reddit-hunt.md` — 20 paste-ready reply drafts (Tier 1-2)
- `2026-04-23-reddit-status.md` — status tracker for Tier 1-2
- `2026-04-23-replies.md` — broader reply drafts + DM library + Bell Tuning hook library
- `outreach_reply_playbook.md` (memory) — reusable structure + char targets + never-use framings

---

## ★★★ Highest-leverage thread of the entire hunt

### T0-01. r/LangChain — "The consulting gig of 2026 is 'please come fix our [LangChain pipelines]'"

**URL:** https://www.reddit.com/r/LangChain/comments/1smz8b7/the_consulting_gig_of_2026_is_please_come_fix_our/
**Status:** queued
**Why this matters:** Meta-post about the market trend where companies are paying consultants to fix broken LangChain prototypes. Every reader of this thread is a self-identified buyer of exactly what Kevin sells. This is the single highest-leverage comment slot in the whole hunt.

**Reply (~1,750 chars, paste this first):**

```
Confirming the trend from the consultant side. The "fix our pipeline" engagements I've seen this year break down into roughly four buckets, in order of frequency:

1. Retrieval quality silently degraded after the corpus grew past the calibration set. Precision@K still looks fine; users say "the answers feel off." Almost always score miscalibration, redundancy attacks from near-duplicate doc revisions, or rank inversion when newer and older doc versions share lexical tokens. None of these move precision@K cleanly.

2. Multi-agent loops in production. Tool fixation, schema drift in error responses, response bloat displacing the original user request. Usually no caps wired up - 25-step cap, wall-clock cap, cost cap per session. Fix is often "rip out AgentExecutor, replace with a plain control loop with hard caps and Pydantic boundaries on every tool input/output."

3. Eval set went stale. Curated 6 months ago, doesn't represent today's queries. Production traffic distribution drifted, the eval suite still passes, but real users are getting bad answers. Fix: continuously sample production traffic into the eval pipeline; treat the eval set as live, not frozen.

4. No observability on intermediate signals. Latency, cost, error rate are tracked. Per-tool-call relevance distribution per session, per-query retrieval score distribution, alignment of working-context-vs-original-goal across steps - all unmonitored. Fix: instrument the shape of these distributions (mean, std, skew, bimodality) so drift surfaces as a leading indicator instead of a support ticket.

The pattern that surprised me: most of these teams have eval suites and tracing tools (Ragas, LangSmith, etc.). The gap is they're measuring the wrong layer. Output-side metrics are lagging. Distributional shape of intermediate signals is leading - several turns of warning before the pipeline visibly fails.

Free 30-min teardowns this week for 3 teams. DM me if you've got a stuck pipeline; will give you the bell curve of your retrieval distribution + flagged pathologies + one prioritized fix. No pitch.
```

**Why the soft offer here is OK:** thread context = consulting marketplace meta-discussion. Direct offer is on-topic and expected, not self-promo.

---

## YC W26 batch — direct outbound (highest dollar-conversion path today)

The April 2026 HN "Who is Hiring" thread (item id=47601859) named these YC W26 companies hiring for RAG/agent work. They have funding, urgency, and Bay Area founder reachability. **Direct cold-DM to founder, not comment-and-wait.**

### T0-02. Arzule (YC W26) — multi-agent coordination
**URL:** https://news.ycombinator.com/item?id=47601859 (find Arzule listing in thread)
**Why ★★★:** Their pitch is literally "fix multi-agent systems that fail due to coordination breakdowns." This is Bell Tuning's tool-call-grader use case spelled out. Possible competitor OR possible partner.

**Cold outreach play:**
- Find their site (search `arzule.ai` or `arzule.com` or via YC company page)
- DM founder via X/LinkedIn or hello@ email
- Lead with: "Your YC pitch overlaps significantly with the observability layer we built (per-tool-call relevance distribution, schema-drift detection, cascading-failure fingerprints). Curious whether your data pipeline could feed our distributional sensors for richer signal, or whether there's a partnership / mutual referral path. 30-min call?"
- Worst case: they decline, you've identified a competitor early. Best case: partnership or acquisition target.

### T0-03. Burt (YC W26) — agent fine-tuning
**URL:** Same HN thread
**Cold outreach play:**
- Find site, DM founder
- Pitch: "We instrument production agent failure modes (tool fixation, schema drift, cascading failures via per-tool-call relevance distribution). Could feed your fine-tuning pipeline real failure-pattern data. Worth a 20-min explore?"

### T0-04. Panta (YC W26) — autonomous insurance brokerage
**URL:** Same HN thread
**Cold outreach play:**
- Insurance + autonomous agents + regulated industry = audit-grade observability is non-optional
- DM: "Building autonomous agents in a regulated industry means you'll need defensible per-decision traceability faster than non-regulated peers. Built free MIT-licensed sensors for exactly this layer. Free 30-min teardown of where Bell Tuning's audit-trail metrics fit your stack."

### T0-05. Corelayer (YC W26) — on-call AI agents
**URL:** Same HN thread
**Cold outreach play:**
- "On-call support" = agent reliability is the product. Bell Tuning's tool-call-grader directly maps.
- DM: "Reliability of on-call agents is the product, not a feature. Built distributional monitoring for exactly the failure modes that look like 'plausible but wrong' in production. Free pilot if useful."

### T0-06. Tensol (YC W26) — hospitality guest comms
**URL:** Same HN thread
**Cold outreach play:**
- Guest comms = high-volume, low-margin, customer-facing = wrong-answer cost is real
- DM: "Guest comms agents fail in ways guests notice and reviews capture. Per-tool-call relevance distribution catches the silent-failure pattern. Free 30-min teardown."

### T0-07. Rinse — logistics AI ops
**URL:** Same HN thread (id=47601859)
**Notes:** Series-funded logistics company. Not YC W26 but actively hiring AI engineers. Larger company = bigger budget, slower close.
**Cold outreach play:**
- Find Head of AI / Eng Lead on LinkedIn
- "Saw the ops-AI hiring posts. Built free observability sensors for the failure modes that sink internal AI ops tools (tool fixation, context drift across multi-step workflows). 30-min teardown of your ops stack if useful."

---

## Direct hiring posts on Reddit (DM the OP, don't comment)

### T0-08. r/MachineLearningJobs — "My team is urgently looking for AI engineers" (Technical_Standard80)
**URL:** https://www.reddit.com/r/MachineLearningJobs/comments/1rrfzwv/my_team_is_urgently_looking_for_ai_engineers/
**Status:** queued
**Why ★★:** OP explicitly hiring builders for production GenAI/RAG/LangGraph. Time-urgent. They have budget RIGHT NOW.

**Approach:** DM Technical_Standard80 directly (not a public comment).

**DM template (~700 chars):**
```
Saw your team is urgently hiring for AI engineers building GenAI/RAG/LangGraph in production. Genuine fit question:

I'm not job-searching, but I run a consulting practice focused on the unglamorous reliability layer (production retrieval/agent observability, the bell curve of context-shape, tool-call distribution monitoring). Most teams ship fast then need help when production starts misbehaving in ways the eval suite doesn't catch.

If your urgency is "we need to ship the next thing," ignore this. If part of the urgency is "the thing we already shipped is silently degrading and we can't keep up with both shipping new features AND fixing the existing one," I do fractional engagements that bridge that gap. Free 30-min teardown if you want a read on whether we'd fit.

Either way, good luck with the hire.
```

Worst case: declined, no harm. Best case: contract engagement starts this week.

---

## Production case-study thread — comment to attract buyers

### T0-09. HN — "Cosmico switched from RAG to agentic search"
**URL:** https://news.ycombinator.com/item?id=47134263
**Why ★★:** Production case study where a company shifted architecture due to RAG accuracy issues. Comment audience = teams considering the same shift.

**Reply (~1,400 chars):**

```
The agentic-search vs RAG framing flattens a real distinction. Worth pulling apart for anyone weighing the same shift:

Agentic search wins on complex/multi-hop queries because the planner can decompose intent into subqueries and reason about partial results. It loses on cost predictability (multiple LLM calls per query, retries, planner overhead) and on latency p99.

But "RAG was inaccurate" usually decomposes into specific retrieval failure modes that agentic search doesn't actually fix - it just papers over them with more LLM calls:

- Score miscalibration as the corpus grows: agentic search re-queries against the same miscalibrated index
- Rank inversion: planner's candidate pool has the same problem
- Redundancy attacks (5 near-duplicate docs evict 5 distinct sources): planner picks 5 from a poisoned pool
- Bimodal retrieval (two clusters both score high): planner has no way to know which cluster is right without ground truth

Hybrid - cheap default RAG + agentic fallback for ambiguous queries - is the right pattern, but the cheap default needs distributional retrieval-quality monitoring or you've just moved the failure into the cheap path. Per-query bell curve of alignment scores (mean, std, skew, bimodality) catches the failure modes precision@K is blind to, regardless of which retrieval pattern sits on top.

Worth getting both layers right before assuming you need to pay 5-10x per query for agentic on everything.
```

---

## Recurring high-value source: HN "Who is Hiring" thread

The first weekday of each month, HN posts "Ask HN: Who is Hiring?" Every AI/RAG/agent company hiring engineers posts there. The next one publishes ~Friday May 1, 2026.

**Standing playbook:**
1. On 2026-05-01, search the thread for `RAG`, `agent`, `LLM`, `context`, `hallucination`, `observability`
2. For each company hiring AI engineers: identify Founder / Head of AI / first ML hire on LinkedIn
3. DM with the same template as the YC W26 companies above, tailored to their domain
4. Track in this file under a new TIER-0 section dated 2026-05-01

Set a calendar reminder for 8 AM ET 2026-05-01.

---

## Standing alerts to set up today

### Reddit alerts (free)
- f5bot.com — alerts when keywords appear on Reddit. Set keywords:
  - `bell tuning`
  - `contrarianai`
  - `Kevin Luddy`
  - `RAG hallucination production`
  - `agent reliability help`
  - `LangChain consultant`

### Google alerts (free)
- alerts.google.com → set:
  - `"Bell Tuning"` (exact match, your branded term)
  - `"contrarianai"`
  - `RAG observability` site:reddit.com OR site:news.ycombinator.com
  - `"need help"` + `RAG production`

### HN alerts via HNRSS
- https://hnrss.github.io/ — generates RSS feeds for HN searches
- Set feeds for: `RAG production help`, `agent reliability consultant`, `langchain fix`
- Subscribe in your feed reader of choice

### Cron-based scrape (existing infra)
The `tools/lead-intel/` system Kevin already built has placeholders for HN/Reddit polling. Wire those collectors next so this is automated rather than weekly-manual.

---

## Today's priority order (do these in this exact sequence)

1. **T0-01** — comment on r/LangChain "consulting gig of 2026" thread (highest leverage, every reader is a buyer)
2. **T0-08** — DM Technical_Standard80 (active hire = real budget, low friction)
3. **T0-02 through T0-06** — find each YC W26 company site, find founder, send tailored cold DM. ~30 min total. Highest dollar-conversion path on this list.
4. **T0-09** — comment on Cosmico HN thread (production-case-study audience)
5. **#09** from `2026-04-23-reddit-hunt.md` — r/Rag metrics question (highest hit-rate of the comment-and-wait set)
6. Set up the standing alerts (15 min) so future hunts are automated

Realistic outcome of 1-3 in the next 2 hours:
- T0-01: 50-200 thread visitors today, 2-5 DMs in the next 48hr
- T0-08: 10% reply rate; 1 reply = call booked this week
- T0-02 to T0-06: 5 founders DM'd, 1-2 reply within 48hr, 1 call booked

That's the realistic same-day-to-this-week consulting-win path. The comment-and-wait Tier 1-2 is supporting volume; Tier 0 is where dollars actually move.

---

## Status tracker (update inline)

| ID | Target | Status | Action date | Outcome | Notes |
|----|--------|--------|-------------|---------|-------|
| T0-01 | r/LangChain consulting gig | complete | 2026-04-23 | pending | Posted; awaiting thread engagement |
| T0-02 | Arzule (YC W26) - Jeffrey Lin, CTO | **connected** | 2026-04-23 | **accepted 2026-04-24** | Follow-up DM w/ partnership axes + 3 time slots sent 2026-04-24; awaiting reply |
| T0-03 | Burt (YC W26) | complete | 2026-04-23 | pending | LinkedIn connect+message route |
| T0-04 | Panta (YC W26) | complete | 2026-04-23 | pending | LinkedIn connect+message route |
| T0-05 | Corelayer (YC W26) | complete | 2026-04-23 | pending | LinkedIn connect+message route |
| T0-06 | Tensol (YC W26) | complete | 2026-04-23 | pending | LinkedIn connect+message route |
| T0-07 | Rinse (logistics) | complete | 2026-04-23 | pending | LinkedIn connect+message route |
| T0-08 | DM Technical_Standard80 | complete | 2026-04-23 | pending | DM sent / public-comment fallback |
| T0-09 | Cosmico HN thread | complete | 2026-04-23 | pending | Comment posted |

Status legend: `queued` / `posted` / `dm-sent` / `connect-sent` / `replied` / `call-booked` / `paid` / `silent` / `declined` / `skip` / `complete` (any of: posted/sent/connected — action taken, awaiting outcome)

---

## Note on LinkedIn DM-gating (encountered 2026-04-23)

LinkedIn restricts direct DMs to:
- 1st-degree connections (must connect first)
- LinkedIn Premium / Sales Navigator subscribers (have InMail credits)
- Open Profile users (anyone with paid premium can DM)

For non-Premium accounts, the standard workaround is **Connect + add a personal note** (LinkedIn allows ~300 chars in the connection note). Note has same effect as a DM for the recipient — they see your name, headline, and note in their notifications.

**Tradeoff:** message capped at 300 chars, AND delivery happens only when they accept your connection request. Acceptance rate for cold connect-with-note is typically 10-30% depending on profile completeness, mutual connections, and note quality.

**Optimization for this batch:** if any recipient *doesn't accept* within 7 days, follow up via:
1. Their company's contact email (`hello@`, `team@`, `founders@`)
2. X/Twitter DM (most YC W26 founders have open DMs)
3. AngelList / Wellfound message
4. Their personal site contact form

Track which channel reaches each target in the Notes column above.

## Follow-up rhythm

- **Day 3 (2026-04-25):** check connection-acceptance rate. For accepted-but-no-reply, do not message again yet.
- **Day 5 (2026-04-27):** for accepted with no reply, send follow-up message (one short sentence — "Wanted to make sure my note didn't get buried — happy to send the framework write-up if useful.").
- **Day 7 (2026-04-30):** for unaccepted, switch to alternate channel (email / X / AngelList).
- **Day 14 (2026-05-07):** archive remaining silent. Move to long-game (newsletter, occasional X engagement, May 1 HN hiring batch).
