# Contrived RAG Pathology Scenarios — Build Spec

Companion to the LangChain quickstart teardown. Where that artifact catches a real pathology in a real public repo, this artifact runs the inverse experiment: **seed each pathology deliberately into a controlled corpus, run the default retriever, and watch retrieval-auditor flag it on cue.**

## Why this exists

The LangChain teardown answers "does this happen in the wild?" — yes, 5 of 6 queries flagged. This artifact answers the next two questions every reader has:

1. **"What does each pathology actually look like?"** (pedagogy)
2. **"Would the auditor catch it if it WAS there, or did it just get lucky on LangChain's chunking?"** (validation)

Three deliverables fall out of this experiment in one weekend:

- A reproducible Jupyter-style walkthrough where each cell isolates one pathology
- A teardown-style README with screenshots + numbers for distribution
- A second magnet content post for LinkedIn / Reddit / HN, on the same template that worked for LangChain teardown

## Goals + non-goals

**Goals**
- Demonstrate every pathology retrieval-auditor flags (RANK_INVERSION, SCORE_MISCALIBRATED, OFF_TOPIC, LOW_DIVERSITY, plus any in `core/pathologies.js` not above)
- Show side-by-side: clean baseline corpus + same corpus with seeded poison
- Make all numbers reproducible from a 4-line `pip install` + `python run.py`
- Keep total runtime ≤ 5 minutes on a laptop CPU
- Use only free, local components (sentence-transformers + chromadb, no paid API)

**Non-goals**
- Not a benchmark of retrieval-auditor against other tools
- Not a claim about LangChain or any vendor — corpus is synthetic
- Not the rescorer remedy demo (that lives in `contrarianai-remedies` private repo when built)

## Corpus design

### Base corpus (N≈200 chunks, target topic: photosynthesis)

Why photosynthesis: well-defined topic, broad open-source text available (Wikipedia, OpenStax Biology, public-domain plant-biology textbooks), clear right/wrong answers anyone can verify without domain expertise.

Source assembly:
1. Wikipedia "Photosynthesis" article
2. OpenStax Biology Chapter 8 (photosynthesis chapter)
3. ~10 paragraphs from a public-domain plant biology textbook (Project Gutenberg)

Chunked at 800 chars / 150 overlap (deliberately different from LangChain quickstart's 1000/200 to avoid copycat optics). Yields ≈200 chunks.

### Seeded poisons (N=12 chunks added to the base, ~6% poison rate)

Each poison is engineered to trip a specific pathology:

| Poison ID | Type | Pathology target | Engineering detail |
|-----------|------|------------------|--------------------|
| P-INV-1 | Rank inversion bait | RANK_INVERSION | Surface-vocab match high, semantic match low. Example: a chunk packed with the words "photosynthesis", "chlorophyll", "light", "energy", but actually describing a kitchen appliance review. Cosine will rank it high; alignment grader will mark it irrelevant. |
| P-INV-2 | Rank inversion bait | RANK_INVERSION | Same shape, different surface vocab cluster (Calvin cycle terms wrapped around an unrelated narrative) |
| P-INV-3 | Rank inversion bait | RANK_INVERSION | Quote-rich poison — a chunk that quotes the ground-truth source verbatim for one sentence then pivots into off-topic content |
| P-MIS-1 | Confidently wrong | SCORE_MISCALIBRATED | A chunk that asserts "Photosynthesis is the process by which plants release CO₂ and absorb O₂" — exact inversion of fact. Surface-similar to truth, semantically inverted. |
| P-MIS-2 | Confidently wrong | SCORE_MISCALIBRATED | Wrong stoichiometry: "Photosynthesis converts 2 H₂O + 12 CO₂ into glucose..." (deliberately fabricated coefficients) |
| P-MIS-3 | Confidently wrong | SCORE_MISCALIBRATED | Wrong location: "Photosynthesis occurs primarily in the mitochondria of plant cells..." |
| P-OFF-1 | Adjacent topic | OFF_TOPIC | Cellular respiration — a legitimate topic, adjacent to photosynthesis, retriever will love it for queries about plant energy metabolism, but it doesn't answer photosynthesis-specific queries |
| P-OFF-2 | Adjacent topic | OFF_TOPIC | Plant taxonomy — discusses chloroplasts in passing, will rank high on chloroplast queries but only mentions them as a structural feature |
| P-OFF-3 | Adjacent topic | OFF_TOPIC | Climate / carbon cycle — tangentially mentions photosynthesis as part of carbon flux discussion |
| P-DIV-1 | Diversity collapse | LOW_DIVERSITY | Three near-duplicate paraphrases of the same Calvin-cycle sentence (P-DIV-1a, P-DIV-1b, P-DIV-1c). Inserted as a cluster. Retrieval will return all three for the same query, leaving no room for diverse answers. |
| P-DIV-2 | Diversity collapse | LOW_DIVERSITY | Three near-duplicate paraphrases of light-reaction definition |

Total: 3 INV + 3 MIS + 3 OFF + 6 DIV = 15 chunks (six of those are intra-cluster duplicates, counted as 2 cluster events). Round to "12 distinct poisons across 4 pathology classes" for headline copy.

### Query set (N=10)

Each query is paired with a ground-truth alignment scoring rule (deterministic regex / keyword / semantic-overlap criterion against a hand-curated answer chunk).

| # | Query | Targets which pathology surface |
|---|-------|--------------------------------|
| Q1 | What is the overall equation of photosynthesis? | Should hit P-MIS-2 (wrong stoichiometry); test SCORE_MISCALIBRATED |
| Q2 | Where in the plant cell does photosynthesis occur? | Should hit P-MIS-3 (wrong organelle); test SCORE_MISCALIBRATED |
| Q3 | Explain the Calvin cycle. | Should hit P-INV-2 + P-DIV-1 cluster; test RANK_INVERSION + LOW_DIVERSITY |
| Q4 | What gases do plants exchange during photosynthesis? | Should hit P-MIS-1 (inverted gas exchange); test SCORE_MISCALIBRATED |
| Q5 | Compare photosynthesis to cellular respiration. | Should hit P-OFF-1 (adjacent topic ranked too high); test OFF_TOPIC |
| Q6 | What is the role of chlorophyll? | Should hit P-INV-1 (surface-vocab bait); test RANK_INVERSION |
| Q7 | How does light wavelength affect photosynthesis? | CLEAN baseline — well-supported in Wikipedia source, no poison engineered |
| Q8 | Describe the light-dependent reactions. | Should hit P-DIV-2 cluster; test LOW_DIVERSITY |
| Q9 | What are C4 and CAM photosynthesis pathways? | CLEAN baseline — niche enough that no poison was engineered for it |
| Q10 | When did photosynthesis first evolve? | OUT-OF-DISTRIBUTION — answer is not in the corpus; should fire OFF_TOPIC for the entire result set |

Two clean baselines (Q7, Q9) + one OOD (Q10) + seven poisoned queries. The clean queries are the control: the retriever should produce healthy distributions on those, proving the auditor is not flagging everything.

## Measurement protocol

1. Build base corpus (clean), embed with `all-MiniLM-L6-v2`, index in chromadb.
2. Run all 10 queries, top-K=5, dump results.
3. Run retrieval-auditor against each query's results. Record per-query: rankQualityR, scoreCalibrationR, diversity score, pathology flags fired, severity, health score, regime.
4. Build poisoned corpus (base + 12 poisons). Re-embed. Re-index.
5. Run same 10 queries against poisoned corpus.
6. Compare pre/post per-query metrics.

### Validation acceptance criteria

For the experiment to be publishable, the following must hold:

- All 7 poisoned queries (Q1-Q6, Q8) must transition from health > 0.5 (clean) to health < 0.4 (poisoned)
- The two clean queries (Q7, Q9) must remain health > 0.5 in BOTH runs (auditor must not be flagging baseline)
- The OOD query (Q10) must fire OFF_TOPIC in both runs (it's OOD regardless of poison)
- Each engineered pathology must surface its targeted flag at severity ≥ 0.4 in the poisoned run on at least one query
- No flag may fire on the targeted query in the clean run (otherwise the poison wasn't the cause)

If any criterion fails, the experiment is broken — fix corpus/retriever/auditor before publishing. Don't massage numbers.

## Deliverables

```
tools/retrieval-auditor/examples/contrived-rag-scenarios/
├── README.md                  ← reader-facing teardown post (built last)
├── SPEC.md                    ← this file
├── corpus/
│   ├── base.txt               ← Wikipedia + OpenStax + Gutenberg (cleaned)
│   ├── poisons.json           ← 12 engineered chunks with metadata
│   └── ground_truth.json      ← per-query answer keys for alignment grading
├── run.py                     ← single-command runner; builds index, runs queries, runs auditor, dumps JSON
├── plot.py                    ← generates one chart per query (same style as langchain-quickstart-teardown/chart_q*.png)
├── results/
│   ├── clean.json             ← per-query auditor output (clean corpus)
│   ├── poisoned.json          ← per-query auditor output (poisoned corpus)
│   └── chart_q*.png           ← 10 charts
└── requirements.txt           ← pinned deps (sentence-transformers, chromadb, numpy, matplotlib, beautifulsoup4)
```

## Implementation order

| Step | Effort | Output |
|------|--------|--------|
| 1. Assemble base corpus from Wikipedia + OpenStax + Gutenberg sources | 1 hr | `corpus/base.txt` |
| 2. Hand-author 12 poison chunks per spec above | 2 hr | `corpus/poisons.json` |
| 3. Hand-author ground-truth answer keys for 10 queries | 1 hr | `corpus/ground_truth.json` |
| 4. Build `run.py`: index → query → auditor (largely lift from `langchain-quickstart-teardown/teardown.py`) | 2 hr | `run.py` |
| 5. Add poisoned-mode toggle to runner | 30 min | `run.py --poisoned` |
| 6. Build `plot.py` for chart output | 1 hr | `plot.py` |
| 7. Run both modes; verify acceptance criteria | 30 min | `results/*.json` |
| 8. Iterate on poisons that don't fire targeted flag | 1-2 hr | revised `poisons.json` |
| 9. Write reader-facing `README.md` (teardown post) | 2 hr | `README.md` |

**Total: 11-12 hours, ~1.5 weekends of focused work.**

## Distribution plan (after build)

- LinkedIn long-form (Kevin's profile) — same template as LangChain teardown
- Cross-post: r/LangChain, r/MachineLearning, r/Rag
- HN comment-only strategy (no link in body, profile bio carries the URL)
- Tweet thread leading with the chart for Q4 (the most visually striking pathology)
- Hook line for headline: *"I built a RAG corpus with 12 deliberate landmines. The default retriever stepped on 11 of them. Here's what each one looks like."*

## Risk + mitigation

| Risk | Mitigation |
|------|-----------|
| "Contrived = unfair" objection | Clean queries (Q7, Q9) are the proof that auditor isn't flagging everything. Lead with that in copy. |
| Poison engineering looks gamed | Publish the full poisons.json. Anyone can see exactly what was inserted. |
| Reader thinks "this is what the retriever SHOULD do" (gotcha-style) | Frame as "here's what each pathology looks like in isolation, so you can recognize it in your own corpus" — pedagogy first, gotcha never. |
| Acceptance criteria fail on first run | That's the experiment. Don't publish until they pass. Fixing them improves both the corpus AND the auditor. |

## Open questions to resolve before build

1. Use `all-MiniLM-L6-v2` (matches LangChain teardown) or upgrade to `bge-small-en-v1.5` (modern strong baseline)? **Recommend MiniLM** — keeps it directly comparable to the LangChain teardown numbers.
2. Top-K = 5 (matches LangChain teardown) or 10 (more headroom for diversity tests)? **Recommend K=5** — same reason.
3. Run only `retrieval-auditor` or also dump precision@5 against ground truth as the comparison baseline? **Recommend both** — precision@5 is the audience's existing mental model; auditor numbers shine when contrasted with "p@5 says fine."

## Cross-link

This artifact lives next to the existing `langchain-quickstart-teardown/` example. The two together cover both the empirical case (real public repo) and the pedagogical case (controlled corpus). Future remedy demo (in private `contrarianai-remedies`) will use the **poisoned corpus from this artifact** as its input — showing that retrieval-rescorer turns the same poisoned-result distribution back to healthy.
