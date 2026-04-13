/**
 * SQLite database for simulation results.
 * Uses sql.js (pure JS, no native deps).
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sim.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id            TEXT PRIMARY KEY,
      scenario      TEXT NOT NULL,
      seed          INTEGER NOT NULL,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      status        TEXT DEFAULT 'running',
      params        TEXT,
      total_turns   INTEGER,
      final_domain_mean  REAL,
      final_domain_std   REAL,
      final_user_mean    REAL,
      final_user_std     REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS steps (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id          TEXT NOT NULL,
      turn            INTEGER NOT NULL,
      timestamp       TEXT NOT NULL,
      token_count     INTEGER,
      event_type      TEXT,
      event_label     TEXT,
      context_length  INTEGER,
      domain_mean     REAL,
      domain_std      REAL,
      domain_skewness REAL,
      domain_kurtosis REAL,
      user_mean       REAL,
      user_std        REAL,
      user_skewness   REAL,
      user_kurtosis   REAL,
      chunk_count     INTEGER,
      domain_histogram TEXT,
      domain_gaussian  TEXT,
      user_histogram   TEXT,
      user_gaussian    TEXT,
      failure_pattern  TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id, turn)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario)`);

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Query helpers ──────────────────────────────────────────

function insertRun(run) {
  const d = getDbSync();
  d.run(
    `INSERT INTO runs (id, scenario, seed, started_at, status, params)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    [run.id, run.scenario, run.seed, new Date().toISOString(), JSON.stringify(run.params || {})]
  );
  save();
}

function completeRun(id, stats) {
  const d = getDbSync();
  d.run(
    `UPDATE runs SET status='completed', finished_at=?, total_turns=?,
       final_domain_mean=?, final_domain_std=?, final_user_mean=?, final_user_std=?
     WHERE id=?`,
    [new Date().toISOString(), stats.totalTurns,
     stats.domainMean, stats.domainStd, stats.userMean, stats.userStd, id]
  );
  save();
}

function insertStep(step) {
  const d = getDbSync();
  d.run(
    `INSERT INTO steps (run_id, turn, timestamp, token_count, event_type, event_label,
       context_length, domain_mean, domain_std, domain_skewness, domain_kurtosis,
       user_mean, user_std, user_skewness, user_kurtosis, chunk_count,
       domain_histogram, domain_gaussian, user_histogram, user_gaussian, failure_pattern)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [step.runId, step.turn, new Date().toISOString(), step.tokenCount,
     step.eventType, step.eventLabel, step.contextLength,
     step.domain.mean, step.domain.stdDev, step.domain.skewness, step.domain.kurtosis,
     step.user.mean, step.user.stdDev, step.user.skewness, step.user.kurtosis,
     step.chunkCount,
     JSON.stringify(step.domain.histogram), JSON.stringify(step.domain.gaussianFit),
     JSON.stringify(step.user.histogram), JSON.stringify(step.user.gaussianFit),
     step.failurePattern || null]
  );
  // Save every 10 steps for performance
  if (step.turn % 10 === 0) save();
}

function getRuns(scenario) {
  const d = getDbSync();
  const sql = scenario
    ? `SELECT * FROM runs WHERE scenario=? ORDER BY started_at DESC`
    : `SELECT * FROM runs ORDER BY started_at DESC`;
  return d.exec(sql, scenario ? [scenario] : []).map(resultToRows)[0] || [];
}

function getRun(id) {
  const d = getDbSync();
  const rows = d.exec(`SELECT * FROM runs WHERE id=?`, [id]);
  return resultToRows(rows[0])?.[0] || null;
}

function getSteps(runId) {
  const d = getDbSync();
  const rows = d.exec(`SELECT * FROM steps WHERE run_id=? ORDER BY turn`, [runId]);
  return resultToRows(rows[0]) || [];
}

function getAggregate(scenario) {
  const d = getDbSync();
  const rows = d.exec(
    `SELECT s.turn,
            AVG(s.domain_mean) as avg_domain_mean,
            AVG(s.domain_std) as avg_domain_std,
            AVG(s.user_mean) as avg_user_mean,
            AVG(s.user_std) as avg_user_std,
            COUNT(DISTINCT s.run_id) as run_count
     FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE r.scenario = ? AND r.status = 'completed'
     GROUP BY s.turn
     ORDER BY s.turn`,
    [scenario]
  );
  return resultToRows(rows[0]) || [];
}

function resultToRows(result) {
  if (!result) return [];
  return result.values.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function getDbSync() {
  if (!db) throw new Error('DB not initialized. Call await getDb() first.');
  return db;
}

module.exports = {
  getDb, getDbSync, save, insertRun, completeRun, insertStep,
  getRuns, getRun, getSteps, getAggregate,
};
