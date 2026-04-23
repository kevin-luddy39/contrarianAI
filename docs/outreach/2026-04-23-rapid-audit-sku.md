# Bell Tuning Rapid Audit — $2,500 SKU

Launched 2026-04-23. Productized version of the custom audit engagement. Fast-turnaround, async, sensor-driven. Intended as same-day cash path + case-study generator for the first 3-5 sales.

---

## The offer

### Price
$2,500 USD, one-time, flat. No scope negotiation.

### Turnaround
48 hours from data handoff (not from purchase — clock starts when the client delivers retriever config + sample queries + corpus sample).

### Capacity
3 audits per week. Scarcity is real (can't fake-deliver on 5/week solo) and justifies premium price.

### What the client gets
- All 5 Bell Tuning sensors run against their data: `context-inspector`, `retrieval-auditor`, `tool-call-grader`, `predictor-corrector`, `audit-report-generator`
- 8-12 page PDF report:
  - Bell curves of per-query alignment distribution
  - Flagged pathologies (per pathology kind: score miscalibration, rank inversion, redundancy attacks, bimodal retrieval, contamination drift, tool fixation if applicable)
  - Prioritized fix list (3-5 items, ranked by effort × impact)
  - Before/after projections where measurable
- 30-minute Zoom walkthrough of findings
- 7 days of Slack / email Q&A post-delivery

### What the client provides
- Retriever config (or read-access to their pipeline)
- 10-20 sample queries representative of production traffic
- Small corpus sample (1k-10k chunks)
- 30-minute onboarding / kickoff call
- Access to any existing eval set or ground-truth labels (optional but useful)

### What the client does NOT get
- Implementation work (this is diagnosis, not remediation)
- Production deployment of the sensors (that's a separate engagement)
- Code changes to their pipeline
- Unlimited scope

### Upsells after delivery
- **Implementation engagement** — wire the sensors into client's production stack. 1-2 weeks, $10k-25k.
- **Remediation sprint** — implement the prioritized fix list. 1-3 weeks, $15k-40k depending on scope.
- **Monthly monitoring retainer** — Bell Tuning Cloud alerts + monthly review. $2k-5k/month.

---

## Stripe Payment Link setup

1. https://dashboard.stripe.com/payment-links → `+ New`
2. Name: `Bell Tuning Rapid Audit`
3. Description: `48-hour turnaround. 5-sensor analysis of your retrieval / agent pipeline. PDF report + 30-min walkthrough call. 7 days of Slack/email Q&A. Limited to 3/week.`
4. Price: `$2,500 USD`, one-time
5. Quantity: customer-adjustable OFF
6. Collect: email (required), name, phone optional
7. After payment: redirect to `https://contrarianai-landing.onrender.com/payment-success.html`
8. Confirmation email: ON
9. Save → copy URL (looks like `buy.stripe.com/xxxx`)

UTM tracking: append `?ref=<channel>-<surface>` per channel:
- LinkedIn post: `?ref=linkedin-rapid-audit-launch`
- r/LangChain thread: `?ref=reddit-langchain-consulting-thread`
- Hamel re-engagement: `?ref=hamel-referral`
- Cold DM: `?ref=dm-<contact-name-slug>`

---

## DM templates by warmth tier

### Pool 1 — Existing `audit_requests` submitters (didn't convert)

```
Subject: Quick offer for [their original ask]

Hi [name],

You filled out the contrarianAI audit form back in [date / month] asking about [paraphrase from their original pain field]. We never closed the loop, that's on me.

I'm productizing the audit work into a faster, cheaper SKU - the Bell Tuning Rapid Audit. $2,500 fixed, 48-hour turnaround. Five sensors run against your retrieval / agent pipeline, 8-12 page report with flagged pathologies and prioritized fixes, 30-min walkthrough call, 7 days of Q&A after.

Limited to 3 audits per week. Two slots open this week.

If your original ask is still unresolved, this is the fastest path to a defensible answer. Pay link, no negotiation: [STRIPE_LINK]?ref=dm-audit-lead-[id]

Or reply with stack details and I'll confirm fit before you pay.

Kevin
```

### Pool 2 — Tier:star Lead Intel contacts (e.g., tkersey, DoddiC)

```
Hi [name],

Saw you starred contrarianAI/context-inspector. Curious whether you ended up using it in a real pipeline, or just bookmarked.

Either way - I'm doing 3 Bell Tuning Rapid Audits this week. $2,500 fixed, 48hr turnaround, 5 sensors run against your retrieval pipeline, full PDF report, walkthrough call. If you're shipping RAG or agents in production and want a defensible read on retrieval-distribution health + flagged pathologies + prioritized fixes, this is the fastest version of the audit work I do.

Pay link: [STRIPE_LINK]?ref=dm-github-star-[handle]
Spec: contrarianai-landing.onrender.com/bell-tuning-rapid-audit (or reply with stack details first)

No pitch beyond this - either it's useful or it's not.

Kevin
```

### Pool 3 — Cold outbound (YC W26 founders, post-acceptance)

Use after LinkedIn/X connection acceptance. For silent-after-7-days, skip to public alerts or newsletter.

```
Hi [founder name],

Following up on the connection note. Quick update: productized the Bell Tuning audit work into a fixed-price SKU - $2,500, 48-hour turnaround, 5 sensors against your retrieval / agent pipeline, full PDF report with flagged pathologies and prioritized fixes.

If [their company] is at the stage where you're about to ship to production and want a defensible read on where the pipeline will break first, this is the fastest version of that read. Pay link: [STRIPE_LINK]?ref=dm-yc-[company-slug]

If the team isn't there yet, ignore. No follow-up beyond this.

Kevin
```

### Hamel Husain re-engagement (separate move, low-probability / high-payoff)

```
Hamel - took your earlier note seriously and productized the audit work into something more concrete. $2,500 Bell Tuning Rapid Audit, 48-hour turnaround, 5 sensors run against the client's pipeline, full PDF report with bell curves and pathology flags.

Reply to your "new eval frameworks daily" point: this isn't an eval framework, it's an unsupervised retrieval-distribution monitoring layer that sits underneath whatever evals you're running. Different place in the stack.

Not asking for time. Asking if you'd refer one of your audit clients to it as a fit-test. I'll discount their first audit to $1,500 for the referral case study. You get a finder's fee or whatever you'd want. We both get a published case study out of it.

Worth 60 seconds of your time even if no?

Kevin
```

---

## Public offer copy

### LinkedIn post (target: 8-10 AM ET Thu-Fri for peak B2B engagement)

```
New offering: Bell Tuning Rapid Audit. $2,500. 48-hour turnaround. Three audits per week.

What you get:
- Five Bell Tuning sensors run against your retrieval / agent pipeline
- 8-12 page PDF report: bell curves of your per-query alignment distribution, flagged pathologies (score miscalibration, rank inversion, redundancy attacks, bimodal retrieval, contamination drift), prioritized fix list ranked by effort and impact
- 30-minute Zoom walkthrough of findings
- 7 days of Slack / email Q&A

What you provide:
- Retriever config (or pipeline read-access)
- 10-20 sample queries representative of production traffic
- Small corpus sample
- 30-minute kickoff call

Why $2,500: this is the productized version of work I usually do as a 1-2 week engagement. Fast turnaround, narrow scope, defensible deliverable.

Why now: most teams shipped RAG in 2024-2025 and are now finding production silently degrading in ways their eval suite doesn't catch. The bell curve of your retrieval distribution surfaces the failure modes before users complain.

Two slots open this week.

DM if you want to discuss fit before paying.
```

**First comment from your own account (link goes here, not in post body):**
```
Pay link + full spec: [STRIPE_LINK]?ref=linkedin-rapid-audit-launch
```

### r/LangChain "consulting gig of 2026" follow-up reply

```
Follow-up to my comment above for anyone currently looking at a stuck pipeline:

I'm opening 3 slots this week for a productized version of the audit work I described. $2,500 fixed price, 48-hour turnaround from data handoff. Five sensors run against your retrieval / agent pipeline. 8-12 page PDF report with bell curves of your per-query alignment distribution, flagged pathologies (score miscalibration, rank inversion, redundancy, bimodal retrieval, contamination drift), prioritized fix list ranked by effort and impact. 30-minute Zoom walkthrough. 7 days of Slack / email Q&A.

Pay link: [STRIPE_LINK]?ref=reddit-langchain-consulting-thread

Or DM first if you want to confirm fit before paying. Works best for teams already running RAG or multi-agent in production who are seeing silent quality degradation that the eval suite doesn't flag.

Two slots open right now.
```

### Short-form X / Twitter version

```
New: Bell Tuning Rapid Audit. $2,500 flat. 48-hour turnaround.

5 sensors run against your retrieval / agent pipeline. PDF report with bell curves, flagged pathologies (miscalibration, rank inversion, redundancy, bimodal, contamination drift), prioritized fixes. Walkthrough call + 7 days Q&A.

3 slots/week. 2 open.

[STRIPE_LINK]?ref=x-launch
```

---

## Delivery checklist (after payment)

When Stripe webhook fires on a new Rapid Audit purchase:

1. **Same day:**
   - Email client with: welcome, kickoff call booking link (Calendly), intake form (stack config, sample queries, corpus sample upload)
   - Log contact in Lead Intel (tier: `paid`)
2. **Day 0-1:** 30-min kickoff call, confirm scope, handoff data
3. **Day 1-2:** Run 5 sensors against their data. Pathology analysis. Draft report.
4. **Day 2:** Write report (8-12 pages). Format as PDF.
5. **Day 2 EOD:** Deliver PDF + book walkthrough call.
6. **Day 3:** 30-min walkthrough call. Record it (with permission). Use as case-study material.
7. **Days 3-10:** Slack/email Q&A window. Keep a log of what questions come up — informs V2 of the product.
8. **Day 10:** Send post-delivery survey. Ask for anonymized case study consent.
9. **Day 14:** Follow up on upsell path (implementation engagement / retainer).

---

## Success metrics (first 30 days)

- 3 audits sold = $7,500 revenue, product validated
- 5 audits sold = $12,500 revenue, V2 pricing decision point (raise to $3,500?)
- 10 audits sold = $25,000 revenue, hiring decision point (add a second person to deliver)

## Failure signals (kill / pivot if true after 14 days)

- 0 sales despite 50+ DMs sent = offer framing wrong, revisit positioning
- 2+ refund requests = deliverable doesn't match expectations, need clearer scope page
- Scope creep on every engagement = need harder boundaries in the intake

---

## Companion files

- `landing/bell-tuning-rapid-audit.html` — public spec + Stripe button
- `tools/lead-intel/target-queries.sql` — SQL target list for warm-contact DMs
- `docs/outreach/2026-04-23-reddit-tier0.md` — Tier 0 outreach (use follow-up reply above in T0-01 thread)
- `docs/outreach/2026-04-23-replies.md` — broader reply drafts + DM library
