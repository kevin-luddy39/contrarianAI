#!/usr/bin/env node
/**
 * Story Lessons simulation runner.
 *
 * Usage:
 *   node story-runner.js                                  # All stories, temp=0.3
 *   node story-runner.js --story three_little_pigs        # One story
 *   node story-runner.js --temps 0.0,0.3,0.7,1.0         # Multiple temperatures
 *   node story-runner.js --story humpty_dumpty --temps 0.3
 */

const { getDb, save } = require('./db');
const { runStorySimulation, BASE_STORIES } = require('./scenarios/story-lessons');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = { story: null, temps: [0.0, 0.3, 0.7, 1.0] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--story' && argv[i + 1]) args.story = argv[++i];
    else if (argv[i] === '--temps' && argv[i + 1]) args.temps = argv[++i].split(',').map(Number);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const db = await getDb();

  // Ensure story_runs and story_steps tables exist
  db.run(`
    CREATE TABLE IF NOT EXISTS story_runs (
      id TEXT PRIMARY KEY,
      base_story TEXT NOT NULL,
      story_name TEXT NOT NULL,
      temperature REAL NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT DEFAULT 'running',
      total_steps INTEGER,
      final_composite_score REAL,
      final_domain_std REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS story_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      step INTEGER NOT NULL,
      phase TEXT,
      phase_name TEXT,
      chapter_num INTEGER,
      label TEXT,
      context_length INTEGER,
      token_estimate INTEGER,
      chunk_count INTEGER,
      domain_mean REAL,
      domain_std REAL,
      domain_skewness REAL,
      domain_kurtosis REAL,
      domain_histogram TEXT,
      domain_gaussian TEXT,
      user_mean REAL,
      user_std REAL,
      system_lessons TEXT,
      ground_truth_lessons TEXT,
      composite_score REAL,
      tfidf_score REAL,
      lesson_match_score REAL,
      concept_overlap REAL,
      llm_judge_score REAL,
      llm_judge_reasoning TEXT,
      temperature REAL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_story_steps_run ON story_steps(run_id, step)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_story_runs_story ON story_runs(base_story)`);
  save();

  const stories = args.story ? [args.story] : Object.keys(BASE_STORIES);

  console.log(`\nStory Lessons Simulation Runner`);
  console.log(`Stories: ${stories.join(', ')}`);
  console.log(`Temperatures: ${args.temps.join(', ')}`);
  console.log(`Total runs: ${stories.length * args.temps.length}`);
  console.log(`Steps per run: 40`);
  console.log(`Total LLM calls: ${stories.length * args.temps.length * 40 * 2} (derive + judge per step)\n`);

  for (const storyKey of stories) {
    const storyInfo = BASE_STORIES[storyKey];

    for (const temp of args.temps) {
      const runId = crypto.randomUUID();
      console.log(`  Running ${storyInfo.name} @ temp=${temp}...`);

      db.run(
        `INSERT INTO story_runs (id, base_story, story_name, temperature, started_at)
         VALUES (?, ?, ?, ?, ?)`,
        [runId, storyKey, storyInfo.name, temp, new Date().toISOString()]
      );
      save();

      const start = Date.now();
      try {
        const results = await runStorySimulation(storyKey, temp, {
          chunkSize: 500,
          onStep: (step) => {
            // Store step
            db.run(
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

            const phase = step.phase === 'base' ? 'BASE' : step.phaseName;
            const score = step.vectorScore.composite.toFixed(3);
            const judge = step.llmJudgeScore.score.toFixed(2);
            process.stdout.write(`\r    Step ${String(step.step).padStart(2)}/40 [${phase.padEnd(20)}] score=${score} judge=${judge} σ=${step.domainStd.toFixed(3)}`);
          },
        });

        const last = results[results.length - 1];
        db.run(
          `UPDATE story_runs SET status='completed', finished_at=?, total_steps=?,
             final_composite_score=?, final_domain_std=?
           WHERE id=?`,
          [new Date().toISOString(), results.length,
           last.vectorScore.composite, last.domainStd, runId]
        );

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`\n    Done in ${elapsed}s. Final score: ${last.vectorScore.composite.toFixed(3)}, Final σ: ${last.domainStd.toFixed(3)}`);
      } catch (err) {
        console.error(`\n    FAILED: ${err.message}`);
        db.run(`UPDATE story_runs SET status='failed', finished_at=? WHERE id=?`,
          [new Date().toISOString(), runId]);
      }

      save();
    }
  }

  save();
  console.log('\nAll runs complete. Data saved to sim.db');
}

if (require.main === module) main().catch(console.error);

module.exports = { main };
