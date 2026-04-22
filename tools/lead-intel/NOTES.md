# Lead Intel — Interpretation Notes

Interpretation context for the `intel_snapshots` + `intel_events` data. Read before drawing conclusions from a single-day spike. Think of this as the `README` the dashboard should make you read first.

---

## 2026-04-15 — `contrarianai-context-inspector` npm 1,428-download spike

**Data points:**
- 4/15: 1,428 downloads (6x the next-highest day)
- 4/16: 357
- 4/17: 78
- 4/18: 34
- 4/19: 7
- 4/20: 31

**Apparent cause (appears in traffic referrers):** a Show HN submission on 2026-04-15 (`https://news.ycombinator.com/item?id=47784837`, title "AI Heartache") pointing to `github.com/kevin-luddy39/context-inspector/`.

**Actual cause (almost certainly): bot traffic on a freshly-published npm package.** The HN post got **1 point** with zero organic comments. A 1-point HN post cannot drive 1,428 downloads of a never-before-seen npm package in a single day. The real mechanism is much more boring:

- **npm mirror scrapers** — `yarnpkg.com`, `jsr.io`, `deno.land/x`, CNPM mirror, internal corporate registries — all pull fresh tarballs on first appearance
- **Security / dep-graph scanners** — Socket, Snyk, Dependabot, Renovate, npm-audit caches — pull metadata + tarball on first publish to score + fingerprint
- **CI / build farm pollers** — some cron-job-driven "latest npm packages" feeds pull every new release for indexing
- **GitHub Advisory / OSV** — the second a package is published, multiple security indexers hit it

**How to verify:** the drop-off pattern from 1,428 → 357 → 78 → 34 → 7 is the fingerprint of a first-publish indexer burst, not a traffic curve. Organic interest decays logarithmically with a long tail; indexer scans decay near-exponentially over the first few days as each system confirms the package hasn't changed.

**Why it matters:** future-you will look at the dashboard and plan a repeat of whatever was done on 4/15 to reproduce the spike. **Don't.** The real demand signal is the **steady-state floor** after the indexer noise dies off — in this dataset, the post-4/18 daily downloads (34, 7, 31, …) are closer to the real-user number. The 14-day sum of ~1,964 downloads is inflated by the indexer burst; the true organic rate is more like 30–60/day trending up.

**The HN post's real contribution:** the 30 GitHub referrers counted as `news.ycombinator.com` over 14 days. Those are real humans who clicked through from HN's `/newest` stream, Algolia search, or from one of the HN-aggregator newsletters that scrape `/newest`. ~2/day is a modest but real channel. The signal says: "HN works as a low-level driver even for failed posts; a successful post would scale this 10–50x."

---

## Interpretation rules for future spikes

When a single-day count jumps more than 3σ above the 14-day median, tag it with one of:

- **`real`** — traffic + clone + referrer + lead data all move together; a named channel correlates (LinkedIn post same-day, HN post with real upvotes, blog mention with identifiable domain in referrers)
- **`bot`** — npm download count spikes with no matching clone / referrer / landing-visit movement; decay is near-exponential over first 72h
- **`unknown`** — looks real but no single channel owns it; hold for 7 days and re-evaluate once trailing data is in

The `intel_snapshots` table does not currently carry this annotation. Until it does, record judgments here with date + subject + tag + one-line reason. Entries below.

### Judgment log

| Date | Subject | Tag | Reason |
|---|---|---|---|
| 2026-04-15 | `contrarianai-context-inspector` npm | `bot` | 1,428 dls with HN post at 1 point and no matching clone/landing spike; decay pattern matches first-publish indexer burst |
| 2026-04-17 | LinkedIn Bell Tuning manifesto post | `real` | Tracked via LinkedIn analytics paste: 102 impressions / 1 link click. Contributed some share of the 49 `linkedin.com` GitHub referrers over 14d |
