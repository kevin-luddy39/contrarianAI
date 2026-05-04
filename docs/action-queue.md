# Action Queue

> Single source of truth. Updated each turn. Read THIS file, not chat scrollback.
> Status flags: `[ ]` open, `[->]` in progress, `[x]` done, `[skip]` deferred/dropped.
> Window: focus on NOW (1-3 items). NEXT and LATER stay parked until NOW empties.

**Last refreshed:** 2026-05-04 (Mon) — after 1st queue rotation

---

## NOW — do these in order, one at a time

### 1. `[ ]` Lineation cold email — highest-ROI single prospect from yesterday's HN scan

Why: direct cousin to grith.ai positioning ("Agentic AI Security Platform — policy enforcement, runtime monitoring, incident workflows, auditability"). Same orthogonal-observability angle as your dead HN comment, this time as cold email where you control delivery.

- Hunter.io → search `lineation.ai` → capture founder/CTO name + direct email
  - Free tier: https://hunter.io/search/lineation.ai (25 searches/mo)
- LinkedIn cross-check the name (confirm role + active)
- If Hunter returns nothing, fallback: `hello@lineation.ai` (their HN posting contact)
- Send email — draft is in chat scrollback (Lineation §Email — named-founder version OR hello@ version per result). Let me know if you want it pasted again.
- Update `manual-contacts.json` after send (template in chat).
- Time: 20 min total (5 lookup + 5 draft tweak + 10 paste-and-send)

### 2. `[ ]` whitepaper.md CTA fix in context-inspector repo

Why: parallel to yesterday's teardown README fix. context-inspector is your highest-converting top-of-funnel (47 npm dl/wk + LinkedIn referrers + Product Hunt + Reddit organic). Whitepaper is the most-read path inside it (14 views / 8 uniq). Currently has zero buy-flow CTA at the bottom = readers leave with nowhere to go.

- Clone or open: `kevin-luddy39/context-inspector` repo
- Edit: `docs/whitepaper.md` → add a closing section with Stripe URL + landing URL (mirror the shape of yesterday's teardown README fix at lines ~140-150)
- Push from PowerShell (per `npm_publish_security_key.md` memory — npm publish needs PowerShell, but git push works in WSL too; either is fine for this since no npm publish here)
- Time: 15 min

---

## NEXT — queued for today, after NOW empties

### 4. `[ ]` HN karma-build comment #1 (Claude Code thread)

- BLOCKER: only proceed if `dang` has unflagged your dead comment OR you're willing to risk burning kevinluddy39 on another comment that may auto-die
- Check: open https://news.ycombinator.com/threads?id=kevinluddy39 in incognito browser. If yesterday's comment is now visible there, you're un-flagged.
- Target thread: https://news.ycombinator.com/item?id=47966935 (Ask HN: Claude Code dies with ANTHROPIC_API_KEY)
- Reply: 4-6 sentence single paragraph from your WSL Claude Code experience. NO bullets, NO links, NO Bell Tuning name-drop.

### 5. `[ ]` Token rotate (security follow-up)

- After Item 1 in original queue (Render GH_TOKEN) is confirmed done: revoke + reissue the gho_ token that leaked into chat yesterday
- Run: `gh auth refresh -h github.com` (browser flow, picks fresh token)
- Update Render env var to new token value

### 6. `[ ]` npm package README CTA — `contrarianai-context-inspector`

- Edit README footer → add audit-buy hook (Stripe link + landing URL)
- Bump patch version, republish via PowerShell ONLY

### 7. `[ ]` LinkedIn substance post — content-led nurture for Nweke + others

- Topic: "the buy-flow CTA placement insight" — observation that LinkedIn audiences route to GH/npm not landing, so audit-buy CTAs need to live IN the artifacts not on landing
- No links to landing in the post. Substance only. Lets Nweke/Boris/etc see organic value, not push.

---

## LATER — this week / blocked / lower priority

### 8. `[ ]` Eve cold email (helloeve.co)

- Founder via Hunter.io. "Multi-agent voice engine, paying customers, agency channel" = budget signal.
- Same template shape as Lineation, tuned for voice/multi-agent angle.

### 9. `[ ]` Wick cold email (wick / @SHeinrichatWick)

- HN posting contact. "Watch real users break them" = verbatim Bell Tuning value prop. Easy template.

### 10. `[ ]` VLM Run cold email (vlm.run)

- Vision-language angle adds twist; honest-broker pitch since your sensors are text-side.

### 11. `[ ]` Engineering Square cold email (@ESqHiring)

- "End-to-end accuracy" pain explicit. Reply via HN-convention contact in their posting.

### 12. `[ ]` Gladly cold email (gladly.ai)

- Customer-facing retail AI in production at Crate & Barrel, Sephora, REI. Big enough to have budget. LinkedIn warm-path to VP Eng.

### 13. `[ ]` YC W26 batch second-channel switch (Burt, Panta, Corelayer, Tensol, Rinse)

- Calendar trigger was 2026-04-30, likely missed. Check `manual-contacts.json` for status. If still pending: switch to X/email per their entries.

### 14. `[ ]` LinkedIn karma-build target list (parallel to HN if Reddit/HN flagging persists)

- If LinkedIn algo starts dampening reach, build comment-history on adjacent technical posts (5-10 over a week) before posting substance. Same pattern as Reddit/HN karma-build. Not urgent unless reach drops.

---

## DONE today

- `[x]` Render `GH_TOKEN` — env var added; live dashboard now has traffic API access. Token rotate sits in NEXT as security follow-up.
- `[x]` Test-data cleanup migration — `is_test BOOLEAN` column added to `audit_requests`, all 3 existing rows (ids 1,2,3) marked TRUE, Pool 1 query + 5 funnel-count queries gated by `is_test = FALSE`, target-queries.sql Q1 same. Verified in Render shell. Pool 1 now returns 0 rows cleanly.
- `[x]` Nweke thread close — connection + warm close + thumbs-up reaction logged in linkedin-targets.json; pivoted next_action to content-led nurture; feedback memory `feedback_outreach_pressure_drift.md` saved.
- `[x]` Teardown README CTA placeholders filled (yesterday's pending) — GH source link + Bell Tuning landing URL now live in `tools/retrieval-auditor/examples/langchain-quickstart-teardown/README.md`.
- `[skip]` Pool 1 sweep — sweep ran 2026-05-04 morning but cohort was all test contacts; no real outreach occurred. Cleanup migration above prevents recurrence.
- `[skip]` Starbridge melissamrec upgrade — LinkedIn search returns no match for that handle. Path dead. Starbridge falls back to original recruiting@ entry status (silent, can drop or wait).
- `[skip]` Arzule (Jeffrey Lin) final-touch — dropped from active pipeline. Higher ROI elsewhere. Per `feedback_outreach_pressure_drift.md`: live signal (silence) confirms move-on, no further nudge.
- `[?]` Joel Schwarzmann LinkedIn fallback — status unconfirmed, awaiting Kevin's update.

## Key finding 2026-05-04

**Form has captured 0 real leads in 25 days of running** (deployed 2026-04-09, today is 2026-05-04). All 3 audit_requests rows were Kevin's own test submissions. Implications:
- The "0 leads / 0 paid" funnel reads in past traffic reports were not "low conversion of real demand," they were "no demand reaching the form at all." Different problem, different fix.
- Confirms the channel-attribution finding from 2026-05-03: external readers route to GH/npm not landing → form is upstream of zero traffic that converts to fill it.
- Action: prioritize NOW items #1 (Lineation cold email — push outbound) + #2 (whitepaper CTA — bring buy-flow into the artifact readers actually reach). Lead-form CTA on landing is downstream of a broken acquisition channel; fixing form copy/flow won't help until acquisition starts working.

---

## Notes

- Per `feedback_outreach_pressure_drift.md`: parse recipient close-cues vs open-cues before drafting. Live signal overrides pre-written next_action.
- Per `reddit_shadowban_playbook.md`: do NOT use `Southern_Cat5374` for new posts. Use `Late_Researcher232` only after confirming 30+ karma.
- Per `npm_publish_security_key.md`: `npm publish` from PowerShell only (hardware 2FA key won't work in WSL).
- Per `operating_principle_go_it_alone.md`: pain-first cold > warm-intro favors. No family network asks.
- **New finding 2026-05-04**: Pool 1 in lead-intel dashboard was test data. Cleanup needed (see NOW #1) before any future Pool 1 references can be trusted.
