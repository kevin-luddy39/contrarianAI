# Bell Tuning Cloud — MVP

> Managed SaaS for unified AI context-window health monitoring. Ingests outputs from all four Bell Tuning sensors, maintains per-workspace history, renders a web dashboard, and exports on-demand audit reports.

This is the revenue vehicle the other tools feed. Free OSS CLIs establish distribution and trust; Bell Tuning Cloud is where team monitoring, alerting, historical analysis, and enterprise features live.

## What it does

```
┌───────────────────────┐      POST /api/ingest            ┌──────────────────────┐
│ context-inspector     │ ────────────────────────────────►│                      │
│ retrieval-auditor     │ ────────────────────────────────►│  Bell Tuning Cloud   │
│ tool-call-grader      │ ────────────────────────────────►│  (Express + SQLite)  │
│ predictor-corrector   │ ────────────────────────────────►│                      │
└───────────────────────┘                                  └───────┬──────────────┘
                                                                   │
                                                   ┌───────────────┴──────┐
                                                   ▼                      ▼
                                         /dashboard.html       /api/workspace/:id/report
                                         (time-series, flags)  (markdown / HTML / JSON)
```

## MVP features

- **Workspaces with API keys.** Admin-protected workspace creation, per-workspace API key for ingest.
- **Ingestion endpoint.** `POST /api/ingest` accepts sensor events (any of the four sensors) with `{sensor, payload, ts}`.
- **Time-series storage.** SQLite-backed event log, per-workspace, indexed on timestamp.
- **Live dashboard.** `dashboard.html?ws=<id>` — aggregate health card, per-sensor sparklines, pathology log table, aggregate-health time chart with regime bands. Refreshes every 15s.
- **On-demand audit report.** `GET /api/workspace/:id/report?format=markdown|html|json` uses `audit-report-generator` internally to render from the latest sensor events.
- **Read-only state API.** `/state` and `/events` for dashboards or external integrations.

## Quick start

```bash
cd tools/bell-tuning-cloud
npm install
npm run seed         # populates a demo workspace with real experiment data
npm start            # listens on http://localhost:4200
```

Seed uses real results from `predictor-corrector/sim/unseen-tide/`, `retrieval-auditor/sim/rag-needle/`, and `tool-call-grader/sim/agent-cascade/`. After `npm run seed` completes it prints the dashboard URL and workspace API key.

Open the URL in a browser. The dashboard shows:
- Overall health with worst-signal-dominates aggregation across the four sensors
- One card per sensor with its latest health, regime, and a 30-point sparkline
- Pathology log sorted by severity across all sensors
- A time-series chart with healthy / drift / contamination / rot bands

## Endpoints

### Admin

```bash
# Create workspace
curl -X POST http://localhost:4200/api/workspaces \
  -H 'x-admin-token: dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"name":"acme-corp"}'
# → { "id": "ws_...", "name": "acme-corp", "apiKey": "btk_..." }

# List workspaces
curl http://localhost:4200/api/workspaces -H 'x-admin-token: dev-admin-token'
```

### Sensor ingestion

```bash
# Ingest a context-inspector analysis
curl -X POST http://localhost:4200/api/ingest \
  -H 'authorization: Bearer btk_...' \
  -H 'content-type: application/json' \
  -d '{
    "sensor": "context-inspector",
    "payload": {
      "health": 0.72,
      "regime": "drift",
      "domain": { "stats": { "mean": 0.65, "stdDev": 0.22, ... } },
      "pathologies": []
    }
  }'
# → { "ok": true }
```

Valid `sensor` values: `context-inspector`, `retrieval-auditor`, `tool-call-grader`, `predictor-corrector`.

### Read

```bash
# Workspace state (latest event per sensor + aggregates)
curl http://localhost:4200/api/workspace/ws_.../state

# Recent events
curl "http://localhost:4200/api/workspace/ws_.../events?limit=100&sensor=retrieval-auditor"

# Audit report (markdown | html | json)
curl "http://localhost:4200/api/workspace/ws_.../report?format=html" > report.html
```

## Tests

```bash
npm test
```

9 integration tests covering workspace creation, ingest happy-path, auth rejection, state aggregation, and report download in both markdown and HTML.

## Production roadmap

What the MVP deliberately does **not** yet have, in rough priority order for the first paying customers:

1. **Real auth** — OAuth via Google / GitHub, per-user sessions, API-key rotation. Currently the admin token is a shared static string.
2. **Multi-tenancy isolation** — row-level security in the DB, query-time tenant enforcement.
3. **Alert webhooks** — `POST webhook on regime transition`, Slack / PagerDuty / email fan-out.
4. **Billing integration** — Stripe metered billing on event volume, usage dashboard.
5. **Retention tiers** — free tier ≤ 5,000 events / 14 days, paid tiers scale up.
6. **Replace sql.js with postgres** — sql.js is fine for the MVP; production wants native Postgres + migrations.
7. **React/Vue dashboard** — the vanilla-JS dashboard is enough to demo, but realistic customer expectations want a richer UI with filtering, saved views, and custom alerting rules.
8. **MCP client integration** — allow direct `mcp-forward` from client MCP implementations to ingest without requiring a wrapper.
9. **Self-host build** — Docker image, Helm chart, and enterprise license for air-gapped deployments.

Each of these is 2–10 days of work. Together they move the MVP to v1.0 shippable-to-customers in roughly 3–5 weeks of focused effort.

## Pricing anchors (design intent)

| Tier | Monthly | Events | Workspaces | Features |
|---|---:|---:|---:|---|
| Free | $0 | 5,000 / mo | 1 | 14-day retention, no alerts |
| Starter | $99 | 50,000 / mo | 3 | 90-day retention, webhooks |
| Team | $999 | 500,000 / mo | 10 | SSO, SLAs, API-key rotation |
| Enterprise | $10K+ / yr | unlimited | unlimited | Self-host, dedicated support |

Comparable real-world anchors: LangSmith ($40 / user / mo + $0.0005 / trace), Langfuse (free → $29 / mo team → enterprise), Arize AI enterprise pricing in the five-figure range annually.

## License

MIT (OSS code). Commercial terms for the hosted product TBD.
