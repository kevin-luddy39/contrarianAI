/**
 * Story Lessons Scenario
 *
 * Progression per base story (40 steps):
 *   Steps 1-10:  Add base story chapters 1-10
 *   Steps 11-20: Add Cinderella chapters 1-10 (contamination)
 *   Steps 21-30: Add Columbus chapters 1-10 (further contamination)
 *   Steps 31-40: Add Alamo chapters 1-10 (max contamination)
 *
 * At each step: derive lessons, compare to ground truth, snapshot stats.
 */

const fs = require('fs');
const path = require('path');
const { analyzeContext } = require('../../core');
const { deriveLessons, judgeLessonsAlignment } = require('../llm');
const { computeAlignmentScore } = require('../scoring');

const STORIES_DIR = path.join(__dirname, '..', 'stories');

function loadStory(filename) {
  return fs.readFileSync(path.join(STORIES_DIR, filename), 'utf-8');
}

function loadGroundTruth() {
  return JSON.parse(fs.readFileSync(path.join(STORIES_DIR, 'ground_truth.json'), 'utf-8'));
}

/**
 * Split text into N equal-token-count chapters.
 */
function splitIntoChapters(text, n = 10) {
  const words = text.split(/\s+/);
  const chunkSize = Math.ceil(words.length / n);
  const chapters = [];
  for (let i = 0; i < n; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, words.length);
    chapters.push(words.slice(start, end).join(' '));
  }
  return chapters;
}

/**
 * Base stories (the 3 nursery rhymes being tested)
 */
const BASE_STORIES = {
  'three_little_pigs': {
    file: 'three_little_pigs.txt',
    name: 'The Three Little Pigs',
    groundTruthKey: 'The Three Little Pigs',
  },
  'little_red_riding_hood': {
    file: 'little_red_riding_hood.txt',
    name: 'Little Red Riding Hood',
    groundTruthKey: 'Little Red Riding Hood',
  },
  'humpty_dumpty': {
    file: 'humpty_dumpty.txt',
    name: 'Humpty Dumpty',
    groundTruthKey: 'Humpty Dumpty',
  },
};

/**
 * Contamination stories (added progressively to each base story)
 */
const CONTAMINATION_STORIES = [
  { file: 'cinderella.txt', name: 'Cinderella', label: 'cinderella' },
  { file: 'columbus.txt', name: 'Christopher Columbus', label: 'columbus' },
  { file: 'alamo.txt', name: 'The Alamo', label: 'alamo' },
];

/**
 * Build the full 40-step progression for a base story.
 * Returns array of { step, phase, phaseName, chapterNum, chapterText, label }
 */
function buildProgression(baseStoryKey) {
  const base = BASE_STORIES[baseStoryKey];
  const baseText = loadStory(base.file);
  const baseChapters = splitIntoChapters(baseText, 10);

  const steps = [];

  // Steps 1-10: Base story chapters
  for (let i = 0; i < 10; i++) {
    steps.push({
      step: i + 1,
      phase: 'base',
      phaseName: base.name,
      chapterNum: i + 1,
      chapterText: baseChapters[i],
      label: `${base.name} ch.${i + 1}`,
    });
  }

  // Steps 11-40: Contamination stories
  let stepNum = 11;
  for (const contam of CONTAMINATION_STORIES) {
    const contamText = loadStory(contam.file);
    const contamChapters = splitIntoChapters(contamText, 10);
    for (let i = 0; i < 10; i++) {
      steps.push({
        step: stepNum++,
        phase: contam.label,
        phaseName: contam.name,
        chapterNum: i + 1,
        chapterText: contamChapters[i],
        label: `${contam.name} ch.${i + 1}`,
      });
    }
  }

  return steps;
}

/**
 * Run a single story-lessons simulation.
 *
 * @param {string} baseStoryKey - e.g., 'three_little_pigs'
 * @param {number} temperature - LLM temperature
 * @param {object} options - { onStep, chunkSize }
 * @returns {Promise<Array>} - Array of step results
 */
async function runStorySimulation(baseStoryKey, temperature = 0.3, options = {}) {
  const { onStep, chunkSize = 500 } = options;
  const base = BASE_STORIES[baseStoryKey];
  const groundTruth = loadGroundTruth();
  const gtLessons = groundTruth[base.groundTruthKey];
  const steps = buildProgression(baseStoryKey);

  let accumulatedContext = '';
  const results = [];

  for (const step of steps) {
    // Add chapter to context
    accumulatedContext += (accumulatedContext ? '\n\n' : '') + `[${step.label}]\n${step.chapterText}`;

    // Analyze context alignment (domain = base story terms)
    const analysis = analyzeContext(accumulatedContext, { chunkSize });

    // Derive lessons via LLM
    let systemLessons, llmJudgeScore, vectorScore;
    try {
      systemLessons = await deriveLessons(accumulatedContext, base.name, temperature);

      // Score: vector-based
      vectorScore = computeAlignmentScore(systemLessons, gtLessons);

      // Score: LLM-as-judge
      llmJudgeScore = await judgeLessonsAlignment(systemLessons, gtLessons, base.name);
    } catch (err) {
      console.error(`  LLM error at step ${step.step}:`, err.message);
      systemLessons = 'ERROR: ' + err.message;
      vectorScore = { composite: 0, tfidfScore: 0, lessonMatchScore: 0, conceptOverlap: 0 };
      llmJudgeScore = { score: 0, reasoning: 'LLM call failed' };
    }

    const result = {
      step: step.step,
      phase: step.phase,
      phaseName: step.phaseName,
      chapterNum: step.chapterNum,
      label: step.label,
      contextLength: accumulatedContext.length,
      tokenEstimate: Math.ceil(accumulatedContext.split(/\s+/).length * 1.3),
      chunkCount: analysis.summary.chunkCount,
      // Domain alignment stats
      domainMean: analysis.domain.stats.mean,
      domainStd: analysis.domain.stats.stdDev,
      domainSkewness: analysis.domain.stats.skewness,
      domainKurtosis: analysis.domain.stats.kurtosis,
      domainHistogram: analysis.domain.stats.histogram,
      domainGaussian: analysis.domain.stats.gaussianFit,
      domainInterpretation: analysis.domain.interpretation,
      // User alignment
      userMean: analysis.user.stats.mean,
      userStd: analysis.user.stats.stdDev,
      // Lessons
      systemLessons,
      groundTruthLessons: gtLessons,
      // Scores
      vectorScore,
      llmJudgeScore,
      compositeScore: vectorScore.composite,
      temperature,
    };

    results.push(result);

    if (onStep) onStep(result);
  }

  return results;
}

module.exports = {
  runStorySimulation, buildProgression, splitIntoChapters,
  BASE_STORIES, CONTAMINATION_STORIES, loadGroundTruth,
};
