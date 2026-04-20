#!/usr/bin/env node
/**
 * Seed the Bell Tuning Cloud with a demo workspace populated from the
 * real experiment outputs of the four sister tools.
 *
 * After running, the dashboard at http://localhost:4200 shows:
 *   - 10 context-inspector events (from Unseen Tide turns 1-10 + 13 + 22 + 40)
 *   - 6 retrieval-auditor events  (from RAG Needle Part A scenarios)
 *   - 7 tool-call-grader events   (from Agent Cascade scenarios)
 *   - predictor-corrector state snapshots
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

async function main() {
  await db.init();

  const ws = db.createWorkspace({ name: 'acme-corp (demo)' });
  console.log(`Created workspace: ${ws.name}  id=${ws.id}  apiKey=${ws.apiKey}`);

  // ── Ingest context-inspector snapshots ─────────────────────
  const unseen = safeLoad(path.resolve(
    __dirname, '..', '..', 'predictor-corrector', 'sim', 'unseen-tide', 'results', 'results.json',
  ));
  if (unseen && unseen.rows) {
    // Pick turns spanning healthy → drift → contamination → rot for visual range.
    const picks = [1, 3, 6, 10, 13, 16, 19, 22, 25, 28, 31, 35, 40];
    let t = Date.now() - (picks.length * 3600_000);
    for (const turn of picks) {
      const row = unseen.rows.find(r => r.turn === turn);
      if (!row) continue;
      const health = 1 - Math.abs(row.mean - unseen.baseline.mean) / 0.35;
      const regime =
        health >= 0.85 ? 'healthy' :
        health >= 0.60 ? 'drift' :
        health >= 0.30 ? 'contamination' : 'rot';
      db.insertEvent({
        workspaceId: ws.id,
        sensor: 'context-inspector',
        health, regime, pathologyCount: 0,
        payload: {
          domain: { stats: {
            mean: row.mean, stdDev: row.stdDev, skewness: row.skew, kurtosis: row.kurt,
            count: row.count || 20, histogram: row.histogram || [],
          } },
          health, regime,
          pathologies: [],
        },
        ts: t,
      });
      t += 3600_000;
    }
  }

  // ── Ingest retrieval-auditor events ────────────────────────
  const rag = safeLoad(path.resolve(
    __dirname, '..', '..', 'retrieval-auditor', 'sim', 'rag-needle', 'results', 'results.json',
  ));
  if (rag && rag.partA && rag.partA.scenarios) {
    let t = Date.now() - (rag.partA.scenarios.length * 1800_000);
    for (const sc of rag.partA.scenarios) {
      db.insertEvent({
        workspaceId: ws.id,
        sensor: 'retrieval-auditor',
        health: sc.health,
        regime: sc.regime,
        pathologyCount: sc.pathologies?.length || 0,
        payload: {
          domain: { stats: sc.stats, scores: [] },
          retrieval: sc.signals,
          health: sc.health,
          regime: sc.regime,
          pathologies: sc.pathologies || [],
          retrievedCount: sc.retrieved?.length || 5,
        },
        ts: t,
      });
      t += 1800_000;
    }
  }

  // ── Ingest tool-call-grader events ─────────────────────────
  const tcg = safeLoad(path.resolve(
    __dirname, '..', '..', 'tool-call-grader', 'sim', 'agent-cascade', 'results', 'results.json',
  ));
  if (tcg && tcg.scenarios) {
    let t = Date.now() - (tcg.scenarios.length * 1800_000);
    for (const sc of tcg.scenarios) {
      db.insertEvent({
        workspaceId: ws.id,
        sensor: 'tool-call-grader',
        health: sc.health,
        regime: sc.regime,
        pathologyCount: sc.pathologies?.length || 0,
        payload: {
          callCount: sc.callCount,
          domain: { stats: sc.stats, scores: [] },
          toolCalls: sc.toolCalls,
          pathologies: sc.pathologies || [],
          health: sc.health,
          regime: sc.regime,
        },
        ts: t,
      });
      t += 1800_000;
    }
  }

  // ── Ingest a synthetic predictor-corrector snapshot ────────
  db.insertEvent({
    workspaceId: ws.id,
    sensor: 'predictor-corrector',
    health: 0.61,
    regime: 'drift',
    pathologyCount: 0,
    payload: {
      engine: 'abm',
      health: 0.61,
      regime: 'drift',
      historyLen: 40,
      signals: {
        forecastError:    0.18,
        baselineDistance: 0.21,
        milneError:       0.0007,
        histogramKL:      0.05,
        histogramW1:      0.08,
      },
      h: 1,
      pathologies: [],
    },
    ts: Date.now(),
  });

  console.log('\nSeed complete. Start the server with `npm start` and open:');
  console.log(`  http://localhost:4200/dashboard.html?ws=${ws.id}`);
  console.log(`\nAPI key (for /api/ingest): ${ws.apiKey}`);
  console.log(`Admin token:               dev-admin-token`);
}

function safeLoad(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { console.log(`  (skipped — ${p.split('/').slice(-3).join('/')} not found)`); return null; }
}

main().catch(err => { console.error(err); process.exit(1); });
