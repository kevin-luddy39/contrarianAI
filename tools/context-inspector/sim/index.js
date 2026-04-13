/**
 * Simulation dashboard server.
 * Serves the dashboard UI, REST API, and WebSocket for live simulation viewing.
 */

const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { getDb, getRuns, getRun, getSteps, getAggregate, save } = require('./db');
const { runSimulation } = require('./engine');
const { runBatch, SCENARIO_MAP } = require('./runner');
const { createRng } = require('./seed-rng');

const app = express();
const PORT = process.env.SIM_PORT || 4001;
const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// ── API Routes ────────────────────────────────────────────

// List runs
app.get('/api/runs', (req, res) => {
  const runs = getRuns(req.query.scenario || null);
  res.json(runs);
});

// Single run
app.get('/api/runs/:id', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

// Steps for a run
app.get('/api/runs/:id/steps', (req, res) => {
  const steps = getSteps(req.params.id);
  res.json(steps);
});

// Compare multiple runs
app.get('/api/compare', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'Provide ?ids=a,b,c' });
  const runs = ids.map(id => {
    const run = getRun(id);
    const steps = getSteps(id);
    return { run, steps };
  }).filter(r => r.run);
  res.json(runs);
});

// Aggregate stats for a scenario
app.get('/api/aggregate/:scenario', (req, res) => {
  const data = getAggregate(req.params.scenario);
  res.json(data);
});

// Available scenarios
app.get('/api/scenarios', (req, res) => {
  res.json(Object.keys(SCENARIO_MAP));
});

// ── Story Lessons API ─────────────────────────────────────
const { runStorySimulation, BASE_STORIES } = require('./scenarios/story-lessons');

app.get('/api/story-runs', (req, res) => {
  try {
    const d = require('./db').getDbSync();
    const filter = req.query.story ? ` WHERE base_story='${req.query.story}'` : '';
    const rows = d.exec(`SELECT * FROM story_runs${filter} ORDER BY started_at DESC`);
    res.json(rows[0] ? rows[0].values.map(row => {
      const obj = {};
      rows[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) : []);
  } catch { res.json([]); }
});

app.get('/api/story-runs/:id/steps', (req, res) => {
  try {
    const d = require('./db').getDbSync();
    const rows = d.exec(`SELECT * FROM story_steps WHERE run_id='${req.params.id}' ORDER BY step`);
    res.json(rows[0] ? rows[0].values.map(row => {
      const obj = {};
      rows[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) : []);
  } catch { res.json([]); }
});

app.get('/api/story-base-stories', (req, res) => {
  res.json(BASE_STORIES);
});

// ── Context Rot API ───────────────────────────────────────
app.get('/api/rot-runs', (req, res) => {
  try {
    const d = require('./db').getDbSync();
    const rows = d.exec(`SELECT * FROM rot_runs ORDER BY started_at DESC`);
    res.json(rows[0] ? rows[0].values.map(row => {
      const obj = {};
      rows[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) : []);
  } catch { res.json([]); }
});

app.get('/api/rot-runs/:id/steps', (req, res) => {
  try {
    const d = require('./db').getDbSync();
    const rows = d.exec(`SELECT * FROM rot_steps WHERE run_id='${req.params.id}' ORDER BY step`);
    res.json(rows[0] ? rows[0].values.map(row => {
      const obj = {};
      rows[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) : []);
  } catch { res.json([]); }
});

app.post('/api/story-simulate', async (req, res) => {
  const { story, temperature = 0.3 } = req.body;
  if (!BASE_STORIES[story]) return res.status(400).json({ error: 'Unknown story' });

  const runId = require('crypto').randomUUID();
  res.json({ runId, status: 'started' });

  setImmediate(async () => {
    try {
      const db = require('./db');
      const d = db.getDbSync();
      d.run(`INSERT INTO story_runs (id, base_story, story_name, temperature, started_at)
             VALUES (?, ?, ?, ?, ?)`,
        [runId, story, BASE_STORIES[story].name, temperature, new Date().toISOString()]);
      db.save();

      const results = await runStorySimulation(story, temperature, {
        onStep: (step) => {
          d.run(
            `INSERT INTO story_steps (run_id, step, phase, phase_name, chapter_num, label,
               context_length, token_estimate, chunk_count,
               domain_mean, domain_std, domain_skewness, domain_kurtosis,
               domain_histogram, domain_gaussian, user_mean, user_std,
               system_lessons, ground_truth_lessons,
               composite_score, tfidf_score, lesson_match_score, concept_overlap,
               llm_judge_score, llm_judge_reasoning, temperature)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [runId, step.step, step.phase, step.phaseName, step.chapterNum, step.label,
             step.contextLength, step.tokenEstimate, step.chunkCount,
             step.domainMean, step.domainStd, step.domainSkewness, step.domainKurtosis,
             JSON.stringify(step.domainHistogram), JSON.stringify(step.domainGaussian),
             step.userMean, step.userStd,
             step.systemLessons, step.groundTruthLessons,
             step.vectorScore.composite, step.vectorScore.tfidfScore,
             step.vectorScore.lessonMatchScore, step.vectorScore.conceptOverlap,
             step.llmJudgeScore.score, step.llmJudgeScore.reasoning, step.temperature]
          );
          broadcast({ type: 'story_step', runId, ...step });
        },
      });

      const last = results[results.length - 1];
      d.run(`UPDATE story_runs SET status='completed', finished_at=?, total_steps=?,
               final_composite_score=?, final_domain_std=? WHERE id=?`,
        [new Date().toISOString(), results.length, last.vectorScore.composite, last.domainStd, runId]);
      db.save();
      broadcast({ type: 'story_run_complete', runId });
    } catch (err) {
      console.error('Story sim error:', err);
      broadcast({ type: 'story_run_error', runId, error: err.message });
    }
  });
});

// Start a single live simulation
app.post('/api/simulate/single', async (req, res) => {
  const { scenario, seed = Date.now(), chunkSize = 500 } = req.body;
  const ScenarioClass = SCENARIO_MAP[scenario];
  if (!ScenarioClass) return res.status(400).json({ error: 'Unknown scenario' });

  const rng = createRng(seed);
  const instance = new ScenarioClass(rng);
  const runId = crypto.randomUUID();

  res.json({ runId, status: 'started' });

  // Run async, streaming via WebSocket
  setImmediate(async () => {
    try {
      await runSimulation(instance, runId, {
        seed, chunkSize,
        onStep: (step) => broadcast({ type: 'step', runId, ...step }),
      });
      broadcast({ type: 'run_complete', runId });
    } catch (err) {
      console.error('Simulation error:', err);
      broadcast({ type: 'run_error', runId, error: err.message });
    }
  });
});

// Start a batch
app.post('/api/simulate/batch', async (req, res) => {
  const { scenario, count = 50, seedBase = 1000 } = req.body;
  if (scenario && !SCENARIO_MAP[scenario]) return res.status(400).json({ error: 'Unknown scenario' });

  res.json({ status: 'started', scenario: scenario || 'all', count });

  setImmediate(async () => {
    try {
      const scenarios = scenario ? [scenario] : Object.keys(SCENARIO_MAP);
      for (const name of scenarios) {
        await runBatch(name, count, seedBase, (progress) => {
          broadcast({ type: 'batch_progress', scenario: name, ...progress });
        });
      }
      broadcast({ type: 'batch_complete' });
    } catch (err) {
      console.error('Batch error:', err);
      broadcast({ type: 'batch_error', error: err.message });
    }
  });
});

// ── Start ────────────────────────────────────────────────

async function main() {
  await getDb();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Simulation dashboard at http://localhost:${PORT}`);
    console.log(`WebSocket at ws://localhost:${PORT}/ws`);
  });
}

main().catch(console.error);
