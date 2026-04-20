#!/usr/bin/env node
/**
 * Bell Tuning Cloud — MVP server.
 *
 * Ingests outputs from the four sensor tools, stores a rolling
 * per-workspace history, serves a web dashboard and a report
 * download endpoint.
 *
 * Endpoints:
 *   POST  /api/workspaces           — create a workspace (returns apiKey)
 *   GET   /api/workspaces           — list workspaces (admin)
 *   POST  /api/ingest               — ingest a sensor event (Authorization: Bearer <apiKey>)
 *   GET   /api/workspace/:id/state  — latest state for a workspace
 *   GET   /api/workspace/:id/events — recent events
 *   GET   /api/workspace/:id/report — rendered audit report (markdown/html/json)
 *   GET   /                          — dashboard (HTML)
 *   GET   /assets/dashboard.js      — dashboard JS
 *   GET   /assets/style.css         — dashboard CSS
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { generateReport } = require(path.resolve(__dirname, '..', 'audit-report-generator', 'core'));

const PORT = process.env.PORT || 4200;
const ADMIN_TOKEN = process.env.BELL_TUNING_ADMIN_TOKEN || 'dev-admin-token';

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'web')));

// ── Auth middleware ────────────────────────────────────────
function requireApiKey(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!m) return res.status(401).json({ error: 'Missing Bearer token' });
  const ws = db.workspaceByApiKey(m[1]);
  if (!ws) return res.status(401).json({ error: 'Invalid API key' });
  req.workspace = ws;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Admin token required' });
  next();
}

// ── Workspace CRUD ─────────────────────────────────────────
app.post('/api/workspaces', requireAdmin, (req, res) => {
  const name = (req.body && req.body.name) || 'untitled';
  const ws = db.createWorkspace({ name });
  res.json(ws);
});

app.get('/api/workspaces', requireAdmin, (req, res) => {
  res.json(db.listWorkspaces());
});

// ── Ingestion ──────────────────────────────────────────────
// Body: { sensor: 'context-inspector' | 'retrieval-auditor' |
//         'tool-call-grader' | 'predictor-corrector', payload: {...} }
const ALLOWED_SENSORS = new Set([
  'context-inspector', 'retrieval-auditor', 'tool-call-grader', 'predictor-corrector',
]);

app.post('/api/ingest', requireApiKey, (req, res) => {
  const { sensor, payload, ts } = req.body || {};
  if (!ALLOWED_SENSORS.has(sensor)) {
    return res.status(400).json({ error: `sensor must be one of ${[...ALLOWED_SENSORS].join(', ')}` });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload object required' });
  }
  const health  = typeof payload.health === 'number' ? payload.health : null;
  const regime  = payload.regime || null;
  const pathologyCount = Array.isArray(payload.pathologies) ? payload.pathologies.length : 0;
  db.insertEvent({
    workspaceId: req.workspace.id,
    sensor, health, regime, pathologyCount,
    payload, ts: ts || Date.now(),
  });
  res.json({ ok: true });
});

// ── State / events ────────────────────────────────────────
app.get('/api/workspace/:id/state', (req, res) => {
  const ws = db.workspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'workspace not found' });
  const stats = db.workspaceStats({ workspaceId: ws.id });
  const state = {};
  for (const sensor of ALLOWED_SENSORS) {
    const events = db.listEvents({ workspaceId: ws.id, sensor, limit: 1 });
    state[sensor] = events[0] || null;
  }
  res.json({ workspace: { id: ws.id, name: ws.name }, sensorStats: stats, latest: state });
});

app.get('/api/workspace/:id/events', (req, res) => {
  const ws = db.workspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'workspace not found' });
  const sensor = req.query.sensor || undefined;
  const limit  = Math.min(parseInt(req.query.limit || '200', 10), 1000);
  res.json(db.listEvents({ workspaceId: ws.id, sensor, limit }));
});

app.get('/api/workspace/:id/report', (req, res) => {
  const ws = db.workspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'workspace not found' });
  const format = req.query.format || 'markdown';
  const latest = {};
  for (const sensor of ALLOWED_SENSORS) {
    const events = db.listEvents({ workspaceId: ws.id, sensor, limit: 1 });
    latest[sensor] = events[0]?.payload || null;
  }
  const report = generateReport({
    title:   `Bell Tuning Audit — ${ws.name}`,
    client:  ws.name,
    auditor: 'contrarianAI / Bell Tuning Cloud',
    date:    new Date().toISOString().slice(0, 10),
    contextInspector:    latest['context-inspector'],
    retrievalAuditor:    latest['retrieval-auditor'],
    toolCallGrader:      latest['tool-call-grader'],
    predictorCorrector:  latest['predictor-corrector'],
    format,
  });
  if (format === 'html')     res.type('text/html').send(report);
  else if (format === 'json') res.type('application/json').send(report);
  else                        res.type('text/markdown').send(report);
});

// Dashboard HTML is served from web/ by static middleware above. The
// root redirect picks the most recent workspace for convenience.
app.get('/', (req, res) => {
  const list = db.listWorkspaces();
  if (list.length === 0) {
    res.sendFile(path.join(__dirname, 'web', 'welcome.html'));
  } else {
    res.redirect(`/dashboard.html?ws=${list[list.length - 1].id}`);
  }
});

async function main() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`Bell Tuning Cloud listening on http://localhost:${PORT}`);
    console.log(`  admin token (set BELL_TUNING_ADMIN_TOKEN env to override): ${ADMIN_TOKEN}`);
  });
}

if (require.main === module) {
  process.stderr.write('[bell-tuning-cloud] starting...\n');
  main().catch(err => {
    process.stderr.write(`[bell-tuning-cloud] startup failed: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = { app };
