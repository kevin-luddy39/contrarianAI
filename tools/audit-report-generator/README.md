# audit-report-generator

> Consumes outputs from context-inspector, retrieval-auditor, tool-call-grader, and predictor-corrector, emits a unified Bell Tuning audit report in markdown / HTML / JSON.

This is the technical foundation of the **Audit-in-a-Box** SKU — a productized version of the consulting engagement that lets customers self-serve a full audit by uploading their sensor outputs.

## Model

```
    context-inspector ─┐
    retrieval-auditor ─┤
    tool-call-grader  ─┼──► audit-report-generator ──► report.md / .html / .json
    predictor-corrector ┘
```

Each sensor input is optional. Sections are emitted only for inputs actually provided. An executive summary is always produced, with overall-health aggregated across sensors using worst-signal-dominates, plus top findings and recommended actions.

## Install & run

```bash
cd tools/audit-report-generator
npm install           # no runtime deps; zero install
npm test              # 6 unit tests
npm run example       # end-to-end: consumes real experiment outputs, produces sample reports
```

The example pulls results from `predictor-corrector/sim/unseen-tide/`, `retrieval-auditor/sim/rag-needle/`, and `tool-call-grader/sim/agent-cascade/` and generates `sim/example-audit/outputs/report.{md,html,json}`.

## CLI

```bash
audit-report-generator audit-config.json
audit-report-generator audit-config.json --format html --out report.html
```

`audit-config.json` bundles the four sensor outputs:

```json
{
  "title": "Bell Tuning Audit — Acme Corp",
  "client": "Acme Corp",
  "auditor": "contrarianAI",
  "date": "2026-04-19",
  "contextInspector":   { ... analyze_context output ... },
  "retrievalAuditor":   { ... audit_retrieval output ... },
  "toolCallGrader":     { ... grade_session output ... },
  "predictorCorrector": { ... healthReport output ... }
}
```

## Output shape

Markdown with these sections (in order, any missing inputs are skipped):

1. **Executive Summary** — overall health, regime, pathology count, top findings, recommended actions
2. **Context Window Analysis** — from context-inspector
3. **Retrieval Quality** — from retrieval-auditor
4. **Multi-Agent Tool Calls** — from tool-call-grader
5. **Trajectory Forecast** — from predictor-corrector
6. **Appendix — Raw Input Summary** — compact per-sensor health + pathology list

HTML format adds minimal inline CSS so the report is presentable without a build step. JSON format returns structured data suitable for rendering in any dashboard.

## Why this is the productization vehicle

The consulting engagement produces one of these reports by hand for each client — context and retrieval audited, pathologies prioritised, actions recommended. This tool automates the document-generation step. Pair it with a web uploader + API key per customer and you have Audit-in-a-Box as a SaaS SKU at the $299–$999 tier.

The Bell Tuning Cloud MVP (`tools/bell-tuning-cloud`) includes a "Download Report" endpoint that calls this generator on demand.

## License

MIT
