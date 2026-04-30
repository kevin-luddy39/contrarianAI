# Email to cousin (Hopkins cardiac surgeon, retired) — DRAFT

Subject (pick one):
- 30 minutes of your eyes on something
- Cardiology AI question — your read?
- Quick favor — do these AI failures actually matter clinically?

---

Hey [Name],

Hope retirement's treating you well. I'm pulling on something and you're the only person in the family who can tell me if I'm onto something or chasing my tail.

I've been auditing how AI retrieval systems handle medical questions — specifically the kind a clinical decision support tool would be asked. I built a corpus from 40 Wikipedia cardiology articles (heart failure, MI, AFib, valve disease, antiarrhythmics, ECG, the usual suspects) and ran 50 cardiology questions from the USMLE-style MedQA bank against it.

The aggregate result is that the AI's retrieval is structurally pretty broken — 66% of cardiac queries triggered at least one measurable retrieval failure. But I can't tell which failures are *clinically* meaningful and which look bad on paper but are actually defensible in context.

That's where you come in. I picked the 5 most striking and would love a 30-minute read from someone who's actually treated these patients.

For each finding I've included:
- The clinical vignette (the question)
- The MCQ answer choices and the correct answer
- The top 5 chunks the AI retrieved
- The numerical measurement showing where the AI got the ranking wrong

Three response options, in increasing order of effort:

1. **Skip.** No reply needed. I'll publish without your name.
2. **Text me yes/no/which-ones-bother-you per finding.** 5-10 min.
3. **30-min phone call.** I'll listen, take notes, and (with permission) include your read with attribution in what I publish. The artifact will say "reviewed by [your name], retired Hopkins cardiac surgeon" — or anonymous if you prefer.

Findings attached / on the next page.

Whatever's the version that doesn't ruin your retirement — appreciate it either way.

Kevin

---

## What's attached

`cousin_review_top5.md` — the 5 findings, formatted for a single read. ~22K characters. Each finding is roughly:

- 70-year-old man, acute pulmonary edema → AI retrieved HF chunks but ranked them in the wrong order
- 69-year-old hypertensive with abdominal pain + foot bruising → AI retrieved peripheral vascular chunks instead of aortic dissection / AAA
- 18-year-old woman with palpitations + lightheadedness → AI retrieved chunks barely related to SVT/POTS
- 5-year-old immigrant with carditis presentation → AI completely missed rheumatic heart disease angle
- 65-year-old with stroke symptoms (likely cardioembolic from undiagnosed AFib) → AI retrieved generic stroke chunks, missed the cardiac source

The question on each: did the AI fail clinically, or is the retrieval-mechanism flag a measurement artifact?

---

## Notes I'm leaving for myself

- Don't nudge. He's retired. One-shot ask.
- If no reply within 14 days → publish anonymized. Don't hold the artifact hostage to his reply.
- If reply yes-call → take notes verbatim; do NOT paraphrase his clinical read in the published artifact.
- If reply text yes-with-clinical-read → quote with permission.
- If reply skip → publish without his name. No hard feelings, log in `manual-contacts.json` so future-me knows the read happened (or didn't).
