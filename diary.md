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
