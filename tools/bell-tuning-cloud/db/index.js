/**
 * SQLite (sql.js) persistence layer for Bell Tuning Cloud.
 *
 * Schema:
 *   workspaces   — one row per customer tenant (id, name, apiKey, createdAt)
 *   events        — one row per sensor ingestion (workspaceId, sensor, health,
 *                   regime, pathologyCount, payload JSON, ts)
 *
 * All data is held in-memory via sql.js. A production deployment would
 * swap this for node-sqlite3 or Postgres without touching the routes —
 * the db module exposes a small async-ish API.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let db;
let dbPath;

async function init({ file } = {}) {
  const SQL = await initSqlJs();
  dbPath = file || path.join(__dirname, '..', 'data', 'bell-tuning-cloud.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  let existing = null;
  if (fs.existsSync(dbPath)) {
    existing = new Uint8Array(fs.readFileSync(dbPath));
  }
  db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      api_key     TEXT NOT NULL UNIQUE,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id     TEXT NOT NULL,
      sensor           TEXT NOT NULL,
      health           REAL,
      regime           TEXT,
      pathology_count  INTEGER,
      payload          TEXT,
      ts               INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_ws_ts ON events(workspace_id, ts);
  `);
  save();
}

function save() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function createWorkspace({ name }) {
  const id = 'ws_' + crypto.randomBytes(6).toString('hex');
  const apiKey = 'btk_' + crypto.randomBytes(16).toString('hex');
  db.run(
    `INSERT INTO workspaces(id, name, api_key, created_at) VALUES (?, ?, ?, ?)`,
    [id, name, apiKey, Date.now()],
  );
  save();
  return { id, name, apiKey };
}

function workspaceByApiKey(apiKey) {
  const r = db.exec(`SELECT id, name, api_key FROM workspaces WHERE api_key = ?`, [apiKey]);
  if (!r.length || !r[0].values.length) return null;
  const [id, name, key] = r[0].values[0];
  return { id, name, apiKey: key };
}

function workspaceById(id) {
  const r = db.exec(`SELECT id, name, api_key FROM workspaces WHERE id = ?`, [id]);
  if (!r.length || !r[0].values.length) return null;
  const [wid, name, apiKey] = r[0].values[0];
  return { id: wid, name, apiKey };
}

function listWorkspaces() {
  const r = db.exec(`SELECT id, name, api_key, created_at FROM workspaces ORDER BY created_at ASC`);
  if (!r.length) return [];
  return r[0].values.map(([id, name, apiKey, created_at]) => ({ id, name, apiKey, createdAt: created_at }));
}

function insertEvent({ workspaceId, sensor, health, regime, pathologyCount, payload, ts }) {
  db.run(
    `INSERT INTO events(workspace_id, sensor, health, regime, pathology_count, payload, ts) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [workspaceId, sensor, health, regime, pathologyCount, JSON.stringify(payload), ts || Date.now()],
  );
  save();
}

function listEvents({ workspaceId, sensor, limit = 200, sinceTs }) {
  const conds = ['workspace_id = ?'];
  const params = [workspaceId];
  if (sensor)   { conds.push('sensor = ?');     params.push(sensor); }
  if (sinceTs)  { conds.push('ts >= ?');         params.push(sinceTs); }
  const sql = `SELECT id, sensor, health, regime, pathology_count, payload, ts FROM events
               WHERE ${conds.join(' AND ')} ORDER BY ts DESC LIMIT ?`;
  params.push(limit);
  const r = db.exec(sql, params);
  if (!r.length) return [];
  return r[0].values.map(([id, sensor, health, regime, pc, payload, ts]) => ({
    id, sensor, health, regime, pathologyCount: pc, payload: JSON.parse(payload || '{}'), ts,
  }));
}

function aggregateHealth({ workspaceId, sensor, sinceTs }) {
  const events = listEvents({ workspaceId, sensor, limit: 1, sinceTs });
  return events.length ? events[0].health : null;
}

function workspaceStats({ workspaceId }) {
  const r = db.exec(
    `SELECT sensor, COUNT(*), AVG(health), MIN(ts), MAX(ts)
     FROM events WHERE workspace_id = ? GROUP BY sensor`,
    [workspaceId],
  );
  if (!r.length) return {};
  const out = {};
  for (const [sensor, n, avg, minTs, maxTs] of r[0].values) {
    out[sensor] = { count: n, avgHealth: avg, firstSeen: minTs, lastSeen: maxTs };
  }
  return out;
}

module.exports = {
  init,
  createWorkspace,
  workspaceByApiKey,
  workspaceById,
  listWorkspaces,
  insertEvent,
  listEvents,
  aggregateHealth,
  workspaceStats,
};
