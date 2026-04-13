#!/usr/bin/env node
/**
 * Context Rot simulation runner.
 *
 * Usage:
 *   node rot-runner.js                              # All 3 stories
 *   node rot-runner.js --story three_little_pigs     # One story
 */

const { getDb, save } = require('./db');
const { runContextRotSimulation, BASE_STORIES, CONTEXT_TOKEN_LIMIT } = require('./scenarios/story-rot');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = { story: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--story' && argv[i + 1]) args.story = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const db = await getDb();

  // Ensure rot_runs and rot_steps tables exist
  db.run(`
    CREATE TABLE IF NOT EXISTS rot_runs (
      id TEXT PRIMARY KEY,
      base_story TEXT NOT NULL,
      story_name TEXT NOT NULL,
      context_limit INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT DEFAULT 'running',
      total_steps INTEGER,
      total_summarizations INTEGER,
      final_composite_score REAL,
      final_judge_score REAL,
      final_domain_std REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rot_steps (
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
      rot_event INTEGER DEFAULT 0,
      summarization_count INTEGER DEFAULT 0,
      context_snapshot TEXT,
      chunk_domain_scores TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_rot_steps_run ON rot_steps(run_id, step)`);
  save();

  const stories = args.story ? [args.story] : Object.keys(BASE_STORIES);

  console.log(`\nContext Rot Simulation Runner`);
  console.log(`Context limit: ${CONTEXT_TOKEN_LIMIT} tokens`);
  console.log(`Stories: ${stories.join(', ')}`);
  console.log(`Auto-summarization triggers when context exceeds ${CONTEXT_TOKEN_LIMIT} tokens\n`);

  for (const storyKey of stories) {
    const storyInfo = BASE_STORIES[storyKey];
    const runId = crypto.randomUUID();
    console.log(`  Running ${storyInfo.name} (context rot mode)...`);

    db.run(
      `INSERT INTO rot_runs (id, base_story, story_name, context_limit, started_at)
       VALUES (?, ?, ?, ?, ?)`,
      [runId, storyKey, storyInfo.name, CONTEXT_TOKEN_LIMIT, new Date().toISOString()]
    );
    save();

    const start = Date.now();
    try {
      const results = await runContextRotSimulation(storyKey, {
        chunkSize: 300,
        onStep: (step) => {
          db.run(
            `INSERT INTO rot_steps (run_id, step, phase, phase_name, chapter_num, label,
               context_length, token_estimate, chunk_count,
               domain_mean, domain_std, domain_skewness, domain_kurtosis,
               domain_histogram, domain_gaussian, user_mean, user_std,
               system_lessons, ground_truth_lessons,
               composite_score, tfidf_score, lesson_match_score, concept_overlap,
               llm_judge_score, llm_judge_reasoning,
               rot_event, summarization_count, context_snapshot, chunk_domain_scores)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [runId, step.step, step.phase, step.phaseName, step.chapterNum, step.label,
             step.contextLength, step.tokenEstimate, step.chunkCount,
             step.domainMean, step.domainStd, step.domainSkewness, step.domainKurtosis,
             JSON.stringify(step.domainHistogram), JSON.stringify(step.domainGaussian),
             step.userMean, step.userStd,
             step.systemLessons, step.groundTruthLessons,
             step.vectorScore.composite, step.vectorScore.tfidfScore,
             step.vectorScore.lessonMatchScore, step.vectorScore.conceptOverlap,
             step.llmJudgeScore.score, step.llmJudgeScore.reasoning,
             step.rotEvent ? 1 : 0, step.summarizationCount,
             step.contextSnapshot, JSON.stringify(step.chunkDomainScores || [])]
          );

          const rot = step.rotEvent ? ' [ROT]' : '';
          const phase = step.phase === 'base' ? 'BASE' : step.phaseName;
          process.stdout.write(`\r    Step ${String(step.step).padStart(2)}/40 [${phase.padEnd(20)}] score=${step.vectorScore.composite.toFixed(3)} judge=${step.llmJudgeScore.score.toFixed(2)} σ=${step.domainStd.toFixed(3)} summaries=${step.summarizationCount}${rot}`);
        },
      });

      const last = results[results.length - 1];
      db.run(
        `UPDATE rot_runs SET status='completed', finished_at=?, total_steps=?,
           total_summarizations=?, final_composite_score=?, final_judge_score=?, final_domain_std=?
         WHERE id=?`,
        [new Date().toISOString(), results.length,
         last.summarizationCount, last.vectorScore.composite, last.llmJudgeScore.score, last.domainStd, runId]
      );

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`\n    Done in ${elapsed}s. Summarizations: ${last.summarizationCount}, Final score: ${last.vectorScore.composite.toFixed(3)}, Judge: ${last.llmJudgeScore.score.toFixed(2)}, σ: ${last.domainStd.toFixed(3)}`);
    } catch (err) {
      console.error(`\n    FAILED: ${err.message}`);
      db.run(`UPDATE rot_runs SET status='failed', finished_at=? WHERE id=?`,
        [new Date().toISOString(), runId]);
    }

    save();
  }

  save();
  console.log('\nAll runs complete. Data saved to sim.db');
}

if (require.main === module) main().catch(console.error);
