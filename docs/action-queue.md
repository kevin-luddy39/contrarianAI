# Action Queue

> Single source of truth. Updated each turn. Read THIS file, not chat scrollback.
> Status flags: `[ ]` open, `[->]` in progress, `[x]` done, `[skip]` deferred/dropped.
> Window: focus on NOW (1-3 items). NEXT and LATER stay parked until NOW empties.

**Last refreshed:** 2026-05-06 (Wed) — start of day

---

## NOW — do these in order

### 1. `[ ]` Apply to top 5 jobs (memos already drafted)

Open `tools/lead-intel/job-scraper/output/applications-2026-05-05-memos/INDEX.md`. Each top-5 row links to a per-job memo with:
- Apply URL at top
- Resume sections to emphasize
- Cover-letter draft (edit before submitting)
- Apply notes

| # | Score | Company | Role |
|---|---|---|---|
| 1 | 30 | **Chess.com** | Senior ML Engineer (remote) |
| 2 | 28 | **Urban Legend** | Backend Engineer Mid-Senior (remote) |
| 3 | 28 | **Fusemachines** | Applied AI Engineer Automation (remote) |
| 4 | 27 | **Sanctuary Computer** | Senior Frontend Developer (remote) |
| 5 | 24 | **Honor Foods** | Front End Full Stack Developer (remote) |

Per memo: 5-15 min depending on portal complexity. Total session: 30-90 min for 5 applications.

After each application, tell me which one + I'll log it (intent=application) so future job-scraper runs auto-exclude that company from the contrarianAI outreach pool too.

### 2. `[ ]` Re-run job-scraper for fresh 7d-window postings

Quick (2 min). May surface new postings overnight that score above current top.

```
node tools/lead-intel/job-scraper/cli-jobs.js --since 7d --us-only
node tools/lead-intel/job-scraper/compose-application.js --top 15
```

If new top-3 emerge after this run, prioritize over the 5/5 batch.

---

## NEXT — queued for today

### 3. `[ ]` Token rotate (security follow-up, 5 min)

`gho_` token leaked into chat 2026-05-04. Hygiene fix:
- Run: `gh auth refresh -h github.com` (browser flow, picks fresh token)
- Update Render `GH_TOKEN` env var to new token value

### 4. `[ ]` LinkedIn substance post — Nweke + network nurture

20 min. Topic: "the buy-flow CTA placement insight" — observation that LinkedIn audiences route to GH/npm not landing, so audit-buy CTAs need to live IN the artifacts not on the landing-page hero. No link in post body. Substance only.

---

## LATER — this week / lower priority

### 5. `[ ]` npm package README CTA — `contrarianai-context-inspector`

Edit README footer → add audit-buy hook (Stripe link + landing URL). Bump patch version, republish via PowerShell ONLY (per `npm_publish_security_key.md` — hardware 2FA key won't work in WSL).

### 6. `[ ]` More cold-email outreach batches

22 unenriched US-eligible candidates remain in yesterday's pool (top-5 was the first batch sent). Next batch (Urban Legend, Fusemachines, Sanctuary Computer, Honor Foods) overlaps with application Tier A targets — defer until application decisions made (don't pitch Bell Tuning to companies you're applying to).

Hunter budget: ~17 of 25 free credits remain this month.

### 7. `[ ]` Engineering Square second-channel switch

Already dropped from outreach pipeline as staffing-firm. Skip unless evidence emerges they're a real product company.

### 8. `[ ]` Product Hunt re-launch (decision parked)

Per `product_hunt_relaunch_decision.md` — re-evaluate after 2026-05-18 silent-close window OR 30+ Reddit karma (now N/A since Reddit paused). Means: re-evaluate after 2026-05-18.

---

## DONE — recent

- `[x]` 2026-05-06: Action queue refreshed; today's priority set; window-task-reminder validated as working pattern (saved to memory).
- `[x]` 2026-05-05: Job-scraper application-intent path built. 22 US-eligible candidates, 15 memos at `output/applications-2026-05-05-memos/`. Reddit karma cadence paused, daily slot reallocated to job-scraper. InsightScout cold email evaluated + parked. Resume parsed, profile saved as memory.
- `[x]` 2026-05-05: Job-scraper outreach-intent path: scrape + Hunter enrich + pitch composer. Sent Trunk Tools (Sarah Buchner CEO) + Haast (Liam King Co-Founder) cold emails via sequencer.
- `[x]` 2026-05-05: Dashboard inflation bug fixed (intel_snapshots referrers/paths were 14x over-counted). Funnel verified Leads:0 after is_test backfill ran via initDb.
- `[x]` 2026-05-05: Reddit karma-build #1 (r/Rag embedding latency) + #2 (r/LLMDevs agent access) posted. Karma 1→2. Hostile-OP scenario surfaced at #2 (deleted in time). Lessons saved to memory. Karma cadence then PAUSED.
- `[x]` 2026-05-04: GH_TOKEN env added to Render. is_test column migration. Nweke thread closed warm. Teardown + whitepaper CTAs filled. Sequencer toolkit shipped + debugged. Hunter API integration. Visit-tracker IP exclusions live. 5 cold emails sent (Lineation, Eve, Wick CTO via Hunter, VLM Run CEO via Hunter, Gladly).
- `[x]` 2026-05-04: Two cron triggers created for cold-email reply-window automation (Day-7 = 2026-05-11 `trig_013hoQrwz6zJXfBV3UpuwpbR`, Day-14 = 2026-05-18 `trig_015wQUNt9gzxZT98aW3RZqx2`). Pre-fire blockers Kevin must fix: GitHub access via `/web-setup`, Gmail MCP at https://claude.ai/settings/connectors. Disable both at https://claude.ai/code/scheduled after fire to prevent annual repeat.

---

## Reply windows running (passive)

| Prospect | Sent | Day-7 fallback | Day-14 silent-close |
|---|---|---|---|
| Lineation | 5/4 | 5/11 (cron-auto) | 5/18 (cron-auto) |
| Eve | 5/4 | 5/11 (cron-auto) | 5/18 (cron-auto) |
| Wick (Jason Adams CTO) | 5/4 | 5/11 (cron-auto) | 5/18 (cron-auto) |
| VLM Run (Sudeep Pillai CEO) | 5/4 | 5/11 (cron-auto) | 5/18 (cron-auto) |
| Gladly (gerad@) | 5/4 | 5/11 (cron-auto) | 5/18 (cron-auto) |
| Trunk Tools (Sarah Buchner CEO) | 5/5 | 5/12 (manual review) | 5/19 (manual review) |
| Haast (Liam King Co-Founder) | 5/5 | 5/12 (manual review) | 5/19 (manual review) |

No replies as of 2026-05-06 morning per Kevin status check. Normal — 7-day window not closed yet.

---

## Notes

- Per `feedback_outreach_pressure_drift.md`: parse recipient close/open cues before drafting. Live signal overrides pre-written next_action.
- Per `feedback_time_budget_calibration.md`: pre-revenue, ≤15 min build improvements just ship — no permission asked.
- Per `feedback_reddit_hostile_op_check.md`: scan for OP bot-roasting before any Reddit post.
- Per `reddit_paused_2026-05-05.md`: daily karma-build is dead. One-off Reddit only when thread bullseyes AND OP not identity-protective.
- Per `npm_publish_security_key.md`: `npm publish` from PowerShell only (hardware 2FA).
- Per `operating_principle_go_it_alone.md`: pain-first cold > warm-intro favors.
- Per `windows_task_scheduler_reminder_works.md`: schtasks /SC ONCE pattern validated for same-day reminders.
