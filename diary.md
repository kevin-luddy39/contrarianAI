# contrarianAI — Project Diary

## 2026-04-09: Day 1 — Launch Sprint

### What happened
- Created 5 LinkedIn posts targeting AI implementation pain points, each with a different angle (hook, contrarian take, case study, checklist, direct ask)
- Built a static landing page (`landing/index.html`) with lead capture form for the AI Risk & Readiness Audit offer
- Landing page includes: hero with guarantee badge, pain stats, audit findings breakdown, deliverables grid, target audience, contrarian positions, and lead capture form
- Personal guarantee positioning: "3+ production issues found or you don't pay"
- Set up GitHub repo and Render deployment for CI/CD

### Key decisions
- Single-page static site (no framework, no dependencies) — fastest path to live
- Dark theme to match technical/contrarian brand positioning
- Formspree for form handling (free tier, no backend needed)
- Render free tier for hosting with auto-deploy from GitHub

### Next steps
- Replace Formspree `YOUR_FORM_ID` with actual endpoint after signup
- Post LinkedIn content starting Tuesday (best engagement window)
- Send personalized messages to 50-100 warm contacts
- Consider $500-1,000 LinkedIn ad test budget targeting CTOs, VPs Engineering, AI/ML leads
- One piece of pain-focused content per day going forward

---

## 2026-04-10: Day 2 — Backend, Stats, Pricing

### What happened
- Migrated repo from `kevin-luddy/contrarianAI` to `kevin-luddy39/contrarianAI` so the contrarianAI Render team owner could connect via GitHub
- Replaced Formspree placeholder with a real Node.js/Express backend (`server.js`)
- Stood up a Render web service + free Render PostgreSQL database via Blueprint sync (`render.yaml`)
- Wired Gmail SMTP (App Password) for transactional email — form submissions notify `kevin.luddy39@gmail.com` with all respondent details
- Added a hidden visit tracker: every page view captures IP, user-agent (parsed into browser/OS/device), referrer, language, path, timestamp into a `visits` table
- Built a stats reporter that emails `luddy.kevin@gmail.com` every 3 hours OR when visits jump by 10+ since last report — window resets after each send
- Stats report includes totals, unique visitors, top referrers/browsers/OS/devices/languages/IPs, and an ASCII hourly distribution chart
- Updated all 5 LinkedIn posts to link to `https://contrarianai-landing.onrender.com/`
- Posted Post 1 ("If you've lost money on AI...") manually as contrarianAI on LinkedIn

### Key decisions
- **Postgres over SQLite**: Render free tier doesn't allow persistent disks on web services, so SQLite-on-disk wasn't viable. Switched from `better-sqlite3` → `sql.js` → `pg` once we landed on Render-managed Postgres (free tier).
- **Two-account email split**: form leads go to `kevin.luddy39@gmail.com`, traffic stats go to `luddy.kevin@gmail.com` — separates "act on this lead" from "monitor the funnel."
- **Visit tracking is invisible**: no client-side JS, no cookie banner trigger, no consent burden. Server-side request logging only.
- **Reporting trigger is OR not AND**: 10-visit threshold catches viral spikes within minutes; 3-hour timer catches slow trickle so we never miss a quiet day.
- **Pricing tiers (recommended, not yet on site)**: $7,500 entry / $15,000 standard / $35,000 deep / $50,000+ enterprise. Anchored to the $47K/month token-waste case study — payback in <1 month at the standard tier.

### Next steps
- Get the App Password for `kevin.luddy39@gmail.com` documented somewhere safe (currently only in Render env vars)
- Watch first stats report come in once organic LinkedIn traffic hits the page
- Schedule Post 2 (contrarian take) for tomorrow morning
- Consider rolling out a `/admin` route protected by basic auth to view audit_requests + visits without needing DB access

---

## 2026-04-10 through 2026-04-12: Days 2–4 — Product, Content, and Context Inspector

### Infrastructure & product

- Converted static site to Node.js Express backend with PostgreSQL (Render free tier)
- Wired Gmail SMTP for transactional email — form submissions notify `kevin.luddy39@gmail.com`
- Added hidden visit tracker (IP, user-agent, referrer, language) with stats reports to `luddy.kevin@gmail.com` every 6 hours or on 10-visit threshold
- Added Stripe back office (`/admin`) with basic auth — create payment links, track leads, view payments
- Excluded own IP (98.24.147.4) from visit tracking
- Connected Render Blueprint sync for auto-deploy
- Added `/api/ping` endpoint for external uptime monitor to keep free tier awake

### Service rename: Audit → Diagnostic

- Renamed "AI Risk & Readiness Audit" to "AI Production Diagnostic" across all user-facing files
- Rationale: "audit" sounds regulatory/compliance, "diagnostic" sounds technical/actionable
- Internal API routes and DB tables kept as `audit_requests` — no migration needed

### Landing page redesign (based on research)

- Researched solo B2B business models: Corey Quinn (Duckbill Group), Troy Hunt, Jonathan Stark, Hamel Husain, Patrick McKenzie
- Redesigned landing page following Jonathan Stark's 9-section sales page formula
- Added transparent 3-tier pricing ($2,500 Quick Scan / $15,000 Full Diagnostic / $7,500/mo Ongoing Advisory)
- Added case study with metrics (60% cost reduction, Series B startup)
- Added FAQ section with real objections
- Changed CTA from "Request Diagnostic" to "Talk to Kevin" (110% conversion increase per Mailmodo data)
- Added urgency: "Taking 3 new diagnostic clients this month"
- Simplified form from 6 fields to 3 required + 1 optional

### Content pages

- `/assessment.html` — 12-question interactive self-assessment with 0/1/2 scoring, live calculation, band-based results, "email me my results" form that stores to DB and sends personalized report
- `/questions.html` — role-based question guide (CEO/CTO/VP Eng/Eng Lead) with CSS-only tabs, 8 questions per role
- `/answers.html` — 12 AI production questions answered (100-150 words each), SEO-optimized with FAQ schema markup
- LinkedIn Posts 1-6 written and posted, including interactive self-assessment post

### Context Inspector tool (`tools/context-inspector/`)

Built a full context window analysis tool with 4 interfaces:

**Core analysis engine** (`core.js`):
- TF-IDF domain alignment with fixed reference domain support
- User alignment scoring (second-person, role terms, named entities, directives)
- Porter stemmer, negation handling (3-word window)
- BPE token counting (via gpt-tokenizer)
- POS tagging + NER (via compromise)
- LDA topic modeling (via lda)
- Readability scores (Flesch-Kincaid, Coleman-Liau, ARI)
- Sentiment analysis (lexicon-based)
- Shannon entropy, cosine similarity matrix, N-gram analysis
- Full statistical suite: mean, σ, skewness, kurtosis, percentiles, IQR, MAD, z-scores, correlation, linear regression, moving average
- Bell curve with Gaussian fit, ±1σ/±2σ bands, rug plot of individual measurements

**Interfaces**:
- CLI: `node cli.js <file> [--user] [--chunk-size N] [--verbose]`
- MCP server: 4 tools (`analyze_context`, `get_bell_curve`, `get_chunks`, `compare_alignment`)
- Web UI at `:4000` with Chart.js bell curves, concentrator toggle, chunk size slider
- HTTP API: `POST /api/analyze`

### Simulation framework (`sim/`)

**3 classic AI workflow scenarios** (50 runs each, 150 total):
- RAG Pipeline: retrieval drift, context rot, noise injection
- Multi-Agent: coordination bloat, tool misroute, self-evaluation loops
- Support Bot: topic drift, sentiment escalation

**Story lessons experiment** — context rot demonstration:
- Fed 3 nursery rhymes (Three Little Pigs, Little Red Riding Hood, Humpty Dumpty) through an AI system
- Added contamination stories chapter-by-chapter (Cinderella, Columbus, Alamo)
- Context limit: 1,700 tokens — when exceeded, drop oldest chapter + resummarize remaining
- Used Claude Sonnet to derive lessons at each step, compared to ground truth via TF-IDF vectors + LLM-as-judge scoring (0.00-1.00)
- Domain alignment scored against FROZEN base story terms (not the shifting context)

**Key finding: the bell curve is a leading indicator of system failure.**
- Three Little Pigs: σ spiked from 0.225 to 0.351 at step 11 while judge still scored 0.85
- Steps 12-14: σ declining (0.290 → 0.248) while judge still passing at 0.75
- Step 15: total collapse — σ=0.053, judge=0.00, never recovers
- 3 steps of warning visible in the graph before output evaluation caught the failure

**Dashboard** (`localhost:4001`):
- Tabs: Runs, Live, Compare, Aggregate, Stories, Context Rot
- Context Rot tab: step slider scrubs through 40 steps with bell curve, score charts, token sawtooth, system lessons text, context text, ground truth comparison
- Self-contained HTML version also generated for offline viewing

### Key decisions

- **Drop+resummarize** for context management (vs summarize-only or FIFO-only): most destructive, most realistic. Compounds eviction loss with compression loss.
- **Fixed domain reference**: bell curve x-axis always answers "how much does this chunk look like the original story?" not "how much does this chunk look like the average of everything." Essential for measuring rot, not just drift.
- **Humpty Dumpty story swap**: replaced Lewis Carroll's Through the Looking Glass chapter with the actual fairy tale retelling. Judge scores went from 0.00 to 0.95 at baseline — the right source text matters.
- **Temperature comparison scrapped**: domain σ is identical across temperatures (same text), only the LLM output varies. Single temp (0.3) sufficient for demonstrating context rot.

### Next steps
- Push landing page redesign (pending approval — currently local only)
- Post LinkedIn Context Inspector article with screenshots
- Consider publishing Context Inspector as standalone npm package
- Explore deploying the simulation dashboard as a public demo
