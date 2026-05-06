# contrarianAI — 30-Second Pitch (canonical assets)

Per Martin Petrov peer-feedback 2026-05-06: the whitepaper is too deep for cold-prospect attention budget. Need a sub-30-second introduction that lands the entire toolbox before the prospect bounces.

These are the canonical short-form assets. Pick the one that fits the channel.

---

## A. Email-paste version (~30 sec read, 95 words)

```
contrarianAI catches AI failures BEFORE output breaks.

By reading the statistical shape of intermediate signals (context alignment,
retrieval scores, tool-call distributions, conversation drift), the framework
detects pathology 3-15 turns before precision@K, eval suites, or LLM-as-judge
can.

Five MIT-licensed OSS sensors (npx-installable):
- context-inspector — context-window degradation
- retrieval-auditor — RAG pathology (rank inversion, score miscalibration)
- tool-call-grader — multi-agent silent failures
- predictor-corrector — drift forecasting
- audit-report-generator — prioritized fix list

Thesis: score every unit, observe the distribution, monitor the shape, forecast the trajectory.
```

---

## B. LinkedIn / X / first-comment version (~20 sec read, 60 words)

```
contrarianAI ships 5 MIT-licensed sensors that catch AI system failures BEFORE the output breaks - by reading the statistical shape of intermediate signals (context alignment, retrieval scores, tool-call distributions). Detects pathology 3-15 turns before precision@K or LLM-as-judge can. Score every unit, observe the distribution, monitor the shape, forecast the trajectory.

npm: contrarianai-{context-inspector, retrieval-auditor, tool-call-grader, predictor-corrector}
```

---

## C. One-line headline (slide deck / banner / signature)

```
contrarianAI: catch AI failures 3-15 turns before output breaks, by reading the statistical shape of intermediate signals.
```

---

## D. Receipt-card variant (visual one-pager outline — for graphic designer or future PNG)

```
+----------------------------------------------------------+
|                    contrarianAI                          |
|  catch AI failures BEFORE output breaks                  |
|                                                          |
|  By reading the SHAPE of intermediate signals            |
|  (context, retrieval, tool calls, drift) the framework   |
|  detects pathology 3-15 turns before precision@K, eval   |
|  suites, or LLM-as-judge metrics can.                    |
|                                                          |
|  5 MIT-licensed OSS sensors:                             |
|  ┌──────────────────────────────────────────────┐        |
|  │ context-inspector                            │        |
|  │   ↳ context-window degradation               │        |
|  │ retrieval-auditor                            │        |
|  │   ↳ RAG pathology (rank inversion etc)       │        |
|  │ tool-call-grader                             │        |
|  │   ↳ multi-agent silent failures              │        |
|  │ predictor-corrector                          │        |
|  │   ↳ drift forecasting                        │        |
|  │ audit-report-generator                       │        |
|  │   ↳ prioritized fix list                     │        |
|  └──────────────────────────────────────────────┘        |
|                                                          |
|  Thesis: score every unit, observe the distribution,     |
|  monitor the shape, forecast the trajectory.             |
|                                                          |
|  npx contrarianai-context-inspector --setup              |
|  https://contrarianai-landing.onrender.com               |
+----------------------------------------------------------+
```

---

## How the variants connect

The whitepaper, the 30-sec pitch, and the cold-email sensors stack like this:

| Asset | Time-to-read | Where it goes |
|---|---|---|
| One-line headline (C) | 3 sec | LinkedIn headline, email signature, slide titles |
| Receipt card (D) | 10 sec | LinkedIn image post, GitHub README header, deck slide |
| LI/X version (B) | 20 sec | LinkedIn post body, HN comment, Reddit reply |
| Email version (A) | 30 sec | Cold-email body header, follow-up nudges |
| Whitepaper full | 5-15 min | For prospects who self-select INTO depth after the 30-sec land |

The whitepaper isn't broken — it's the wrong asset to LEAD with. It's the asset to point a HOOKED prospect at.

---

## Cold-email retrofit: replace 3-bullet pitches with the email version

Current cold-email template (per `2026-04-23-rapid-audit-sku.md` and the job-scraper composer): 3-bullet pain examples + soft CTA. Each email is ~1700-2000 chars and the recipient has to do the work of mapping the bullet patterns to "what does contrarianAI ship?"

Better shape: lead with the 30-sec pitch (variant A), THEN one tailored pain bullet, THEN the audit offer. Same total length but the prospect knows what the offering IS within 30 seconds, which is what Martin's feedback says they have.

Old structure:
```
Hi [name],
[3 long pain bullets]
[teardown link]
[free 30-min offer]
```

New structure:
```
Hi [name],
[30-sec pitch — variant A]
The reason this matters for [your specific role/pain]:
[1 tailored pain bullet]
[teardown link]
[free 30-min offer]
```

This is the change to apply on the next cold-email batch. Existing in-flight emails (sent 5/4-5/5) stay as is — they're in reply windows.

---

## Re-engaging Martin Petrov (now)

Martin gave the feedback. The right next move is to thank him + send him the 30-second version + ask whether THAT lands the framework's value in his attention budget. If yes: he becomes a peer-validator + potential co-marketer (1000+ LinkedIn followers in AI Architect space = real reach). If no: more iteration needed.

Draft for Martin (peer-question, NOT pitch):

```
Hi Martin - quick followup on the conversation we had about
context-inspector. Your feedback that the whitepaper is too deep for
prospect attention spans landed hard. Distilled the entire toolbox
into a 30-second version below; would value your read on whether THIS
shape lands the value in the attention budget you have for incoming
pitches:

[paste variant A]

If this is closer to digestible, that's a real unblock for the
outreach. If still too dense, happy to keep iterating. Either reading
helps.

Kevin
```

~120 chars header + the pitch + ~70 char close. ~700 chars total.
