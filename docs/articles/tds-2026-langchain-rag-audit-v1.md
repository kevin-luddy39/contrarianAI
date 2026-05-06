# I Audited LangChain's RAG Quickstart — 5 of 6 Queries Failed Distributional Tests

### What happens when you run a distributional auditor against the canonical RAG demo: rank inversion, score miscalibration, and three pathology flags on the most on-topic query in the dataset.

> **Header image:** `chart_q4.png` from the teardown repo (the rank-inversion plot for Query 4 — top-ranked chunk has lowest alignment).

---

## TL;DR

I ran a distributional auditor against the LangChain RAG quickstart's default retriever, on its canonical demo corpus (Lilian Weng's "LLM Powered Autonomous Agents"), with six queries you'd actually ask of that post.

Five of the six queries came back with pathology flags. One was clean. One adversarial query was correctly identified as out-of-distribution.

The most striking failure was on the **most on-topic query in the entire dataset**: the retriever's ranking of returned chunks was *anti-correlated* with their actual alignment to the query (Pearson r = **-0.611**). Its self-reported similarity scores anti-correlated with independent alignment too (r = **-0.675**). The most relevant chunk ranked **fourth**.

`precision@5` against ground truth would have called this a clean retrieval. The eval suite passes. The user gets the wrong answer.

This is the gap I keep running into in production RAG audits, and it's invisible to most monitoring stacks because they collapse distributional signal into top-line averages. This article shows the data, the methodology, the script, and what to do about it.

---

## Why this matters

The complaint I get from teams running RAG in production isn't "our retrieval is broken" — it's "our eval suite passes but the answers feel off."

That phrase, *the answers feel off*, is the user-side projection of a measurement gap. The standard eval stack measures the right things (precision@K, recall@K, sometimes LLM-as-judge), but it measures them at the wrong layer. It looks at the **output** — were the right chunks retrieved, was the answer plausible — and it can't see the **shape** of how the retriever got there.

Shape matters because retrieval is not a binary "right chunk or wrong chunk" problem. It's a distributional problem. A retriever that returns five chunks where the most relevant one is ranked fourth out of five has *technically* retrieved relevant material — and will pass any precision@K test — but it has handed the LLM a context window where the strongest signal is buried under weaker ones. The LLM weighs the top result heaviest. The output drifts.

This article runs that argument with data, on the most canonical RAG demo in the ecosystem, and shows the failure modes that distributional analysis catches and threshold-based monitoring does not.

---

## Methodology

The setup mirrors the LangChain RAG quickstart almost exactly:

- **Corpus**: Lilian Weng's "LLM Powered Autonomous Agents" — the same blog post the LangChain RAG tutorial uses as its canonical demo.
- **Retriever**: LangChain default — cosine similarity over `all-MiniLM-L6-v2` embeddings, top-5 retrieval.
- **Vector store**: ChromaDB.
- **Queries**: six things you'd actually ask of that post:
  1. What is Chain of Thought prompting?
  2. How does ReAct differ from Reflexion?
  3. What memory mechanisms do LLM agents use?
  4. When does an agent decide to use a tool vs respond directly?
  5. Show me the planning loop for a long-horizon task.
  6. What is reward shaping? *(adversarial — not in the corpus)*

For each query, I computed the retrieval-auditor's distributional moments per call:

- **Mean alignment** of retrieved chunks (against an independent alignment measure)
- **Standard deviation** (the spread that tells the LLM whether top results are confidently relevant or borderline)
- **Rank quality (Pearson r)** between the retriever's rank order and actual alignment
- **Score calibration (Pearson r)** between the retriever's similarity scores and actual alignment
- **Health score** (composite of the above, normalized 0-1)
- **Pathology flags** (`OFF_TOPIC`, `RANK_INVERSION`, `SCORE_MISCALIBRATED`, `OUT_OF_DISTRIBUTION`, etc.)

The full script (~80 lines of Python, no paid APIs) is at the bottom of the article. It runs locally, free.

---

## The headline finding (Query 4)

**Query:** "When does an agent decide to use a tool vs respond directly?"

This is — literally — what the Lilian Weng post is *about*. It is the central theme of the agent-architecture section. There is no more on-topic query you could ask of that corpus.

The default retriever returned 5 chunks. Their alignment scores against the query, in rank order:

```
rank 1: 0.1139
rank 2: 0.1497
rank 3: 0.2085
rank 4: 0.2349   ← actually the most relevant
rank 5: 0.1640
```

The retrieval-auditor's reading:

| Metric | Value | Interpretation |
|---|---|---|
| `rankQualityR` | **-0.611** | Ranking is **anti-correlated** with alignment. Top result is least relevant. |
| `scoreCalibrationR` | **-0.675** | Similarity scores anti-correlate with alignment. Confidence is upside-down. |
| Mean alignment | 0.174 | Floor-of-useful retrieval |
| Health score | 0.099 | Regime: "rot" |
| Flags | `OFF_TOPIC`, `RANK_INVERSION`, `SCORE_MISCALIBRATED` | Three pathologies fire simultaneously |

**Precision@5 against ground truth would say: 5 chunks retrieved. Eval passes.**

> [Insert chart_q4.png — the rank-inversion plot showing alignment vs rank position, with the regression line going DOWN]

What's happening structurally: cosine similarity over a small embedding model is not, in this case, a faithful proxy for semantic alignment to the query. The retriever's confidence is not just wrong — it's systematically inverted on this query. The LLM downstream gets handed a top-1 chunk that is the *least* useful of the five, weighted as if it were the most useful. No precision@K test can see this. No LLM-as-judge stage can see this from the output side, because the output simply reflects whatever chunks were over-weighted.

---

## The other four flagged queries

All six query results in one table:

| # | Query | Mean alignment | Health | Flag |
|---|-------|----------------|--------|------|
| 1 | What is Chain of Thought prompting? | 0.135 | 0.225 | `OFF_TOPIC` |
| 2 | How does ReAct differ from Reflexion? | 0.114 | 0.207 | `OFF_TOPIC` |
| 3 | What memory mechanisms do LLM agents use? | **0.391** | **0.710** | *(none — clean)* |
| 4 | When does an agent decide to use a tool? | 0.174 | 0.099 | `OFF_TOPIC`, `RANK_INVERSION`, `SCORE_MISCALIBRATED` |
| 5 | Show me the planning loop for a long-horizon task. | 0.203 | 0.360 | `OFF_TOPIC` |
| 6 | What is reward shaping? *(adversarial)* | 0.036 | 0.065 | `OUT_OF_DISTRIBUTION` |

Every flagged query has a direct, unambiguous answer in the source post. Lilian Weng's article literally defines Chain of Thought, walks through ReAct, contrasts it with Reflexion, and describes the planning loop. The default retriever pulls chunks averaging ~0.15 alignment for queries that should land on text averaging ~0.7+.

The auditor isn't claiming these queries can't be answered from the corpus. It's saying the retriever is failing to surface the answers it has — at a rate the eval suite cannot detect.

> [Insert chart_q1.png — Chain of Thought query, showing flat-low alignment distribution with mean 0.135]

---

## The clean baseline (Query 3)

**Query:** "What memory mechanisms do LLM agents use?"

```
mean alignment:   0.391
stdDev:           0.132
health score:    0.710
flags:            (none)
```

This is what a healthy retrieval looks like. Higher mean alignment, distribution spread that suggests genuine relevance separation, no pathology flags. The auditor doesn't false-fire on clean retrievals — Query 3 is the negative control, and it confirms the methodology distinguishes "this retriever is failing" from "this retriever is working."

The lesson is in the contrast. On the **same corpus**, with the **same retriever**, with the **same embedding model**, query-by-query the retrieval quality varies by an order of magnitude on the auditor's health metric. Most production RAG monitoring won't show you that variance because it's collapsing per-call signal into top-line averages.

> [Insert chart_q3.png — clean baseline distribution]

---

## The adversarial check (Query 6)

**Query:** "What is reward shaping?"

This term doesn't appear in the corpus. It's a reinforcement-learning concept, not an LLM-agents concept. I included it to test whether the auditor distinguishes "the retriever is failing" from "the corpus genuinely doesn't contain what was asked."

```
mean alignment:   0.036
stdDev:           0.049
health score:    0.065
flag:             OUT_OF_DISTRIBUTION
```

Distinct flag. Distinct severity profile. The auditor correctly identifies this as a different failure mode than the four `OFF_TOPIC` queries above — the corpus genuinely lacks the topic, rather than the retriever picking poorly from available material.

> [Insert chart_q6.png — out-of-distribution distribution]

This matters for production triage. "Retriever is broken" and "user asked something the corpus doesn't cover" need fundamentally different fixes. Output-side metrics conflate them. Distributional analysis separates them.

---

## Why precision@K misses all of this

Precision@K answers a single question: of the K chunks retrieved, how many are labeled relevant against ground truth?

For Query 4 above, suppose the ground-truth set is "any chunk discussing tool-use decisions." All 5 retrieved chunks discuss tool-related material to some degree. **Precision@5 = 1.0. Eval passes.**

What precision@K *cannot* see:

- The retriever ranked the **least** relevant chunk first
- The retriever's similarity scores **anti-correlate** with actual alignment
- The mean alignment is near the floor of what a useful retrieval should produce
- The variance is too tight to give the LLM useful signal about which chunk to weight

These distributional properties show up for free if you measure them. They are invisible if you don't.

The distinction matters because LLM behavior downstream of retrieval is sensitive not only to *what* chunks are returned but to *how they're ordered and weighted*. A model handed a top-1 chunk that the retriever scored as most-confident will trust it disproportionately. If that top-1 is in fact the least relevant of the set, the LLM's answer rests on the worst available foundation. The output may still be plausible — that's part of what makes the failure silent — but it's grounded incorrectly.

---

## Caveats and scope

The LangChain RAG quickstart is meant to be simple, not production-ready. **I'm not arguing LangChain ships broken RAG.** Quickstart code is supposed to be quickstart code; it's optimized for clarity, not robustness. The point is that the failure modes I just measured *do not get caught by precision@K, do not get caught by LLM-as-judge, and do not get caught by the eval suite that ships with most production RAG implementations*. They survive contact with prod. They are what produces the "answers feel off" complaint.

The auditor isn't claiming to be a ground-truth oracle. It's distributional analysis. It surfaces shape problems that K-fold precision is blind to, regardless of whether the underlying retriever is the LangChain default or something more sophisticated.

The embedding model is `all-MiniLM-L6-v2` because that's what the LangChain quickstart uses. A larger embedding model would shift the absolute alignment numbers but not the structural findings — rank inversion and score miscalibration are properties of the retriever's scoring function, not the embedding alone. I tested with one corpus, six queries, one retriever, one embedding model. This is one teardown. Run it on your own pipeline and see what you get.

---

## Reproduction

The teardown script is ~80 lines of Python. Sentence-transformers (free, local) for embeddings. Chroma for the vector store. retrieval-auditor for the analysis. No paid APIs.

```bash
pip install sentence-transformers chromadb requests beautifulsoup4 numpy matplotlib
npx contrarianai-retrieval-auditor --help
```

Full script + raw results JSON: [github.com/kevin-luddy39/contrarianAI/tree/main/tools/retrieval-auditor/examples/langchain-quickstart-teardown](https://github.com/kevin-luddy39/contrarianAI/tree/main/tools/retrieval-auditor/examples/langchain-quickstart-teardown)

`retrieval-auditor` itself is MIT-licensed and `npx`-installable: `npx contrarianai-retrieval-auditor`

---

## What to do with this

If you run distributional analysis against your own production retrieval and you get clean health scores across queries, your retriever is in better shape than the canonical RAG quickstart. Worth knowing.

If you get flags — especially `RANK_INVERSION` or `SCORE_MISCALIBRATED` — those are diagnosable, and the fixes are usually narrow:

- **Re-fit a small reranker.** A learned reranker (cross-encoder, bge-reranker-base, etc.) will often correct rank ordering even when the underlying embeddings are noisy.
- **Change chunking strategy.** Some rank inversions are caused by the right answer being split across chunk boundaries; the retriever sees no single chunk that's strongly aligned and falls back to noisy approximations.
- **Change the embedding model.** A larger or more domain-specialized embedding can correct some of the alignment-floor problems, though it doesn't always fix rank inversion in the same way a reranker does.
- **Switch retrieval strategy.** Hybrid (sparse + dense) retrieval often outperforms pure-dense for technical content, and re-introduces some of the term-matching signal that pure cosine similarity over compact embeddings can lose.

The point of measuring at this layer is not to replace your existing eval. It's to give you a leading indicator that something is wrong before users start complaining. The shape goes pathological turns before the output does.

---

## The broader point

There's a productive tension in the AI engineering community right now between teams that have invested heavily in eval infrastructure (precision@K test sets, LLM-as-judge harnesses, hand-curated golden datasets) and teams who say their evals are "passing" while users complain. Both can be right at the same time, and that's the structural finding worth holding on to:

- The eval suite is measuring something real.
- The user is reporting something real.
- The two diverge because they look at different layers.

Distributional analysis is the layer underneath. It catches *shape* failures — pathologies in how the retriever orders, weights, and scores chunks — that pass any threshold-based binary "did this chunk count as relevant" test. Once you measure shape, you start to see why the eval-passes-but-answers-feel-off complaint is so consistent across teams: it's not that one of the parties is wrong, it's that both parties are looking at parts of the same elephant.

Worth getting both layers right before assuming you need to pay 5-10x per query for agentic search on everything.

---

*Kevin Luddy is the founder of contrarianAI, where he builds open-source distributional sensors for production AI systems. The retrieval-auditor used in this teardown is one of five MIT-licensed npm packages in the contrarianAI toolbox, alongside `context-inspector` (context-window degradation), `tool-call-grader` (multi-agent silent failures), `predictor-corrector` (drift forecasting), and `audit-report-generator` (prioritized fix lists). All five are at* [*github.com/kevin-luddy39*](https://github.com/kevin-luddy39) *and on npm. Reach Kevin at* [*github.com/kevin-luddy39*](https://github.com/kevin-luddy39) *or via the* [*contrarianAI landing page*](https://contrarianai-landing.onrender.com)*.*
