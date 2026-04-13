/**
 * Story Context Rot Scenario
 *
 * Demonstrates context rot by enforcing a tight context window.
 * When accumulated context exceeds the limit, it's auto-summarized
 * (lossy compression), destroying details progressively.
 *
 * The context window is sized to barely hold the largest nursery rhyme
 * (~1700 tokens). As contamination stories are added chapter by chapter,
 * the system must summarize to stay within budget — and every summary
 * loses information about the original story.
 *
 * Progression per base story (40 steps):
 *   Steps 1-10:  Base story chapters (fits in window, no summarization needed)
 *   Steps 11-20: Cinderella chapters (forces summarization starting ~step 12-13)
 *   Steps 21-30: Columbus chapters (repeated summarization compounds losses)
 *   Steps 31-40: Alamo chapters (maximum rot — original story is a ghost)
 */

const fs = require('fs');
const path = require('path');
const { analyzeContext, extractDomainTerms } = require('../../core');
const { deriveLessons, judgeLessonsAlignment } = require('../llm');
const { computeAlignmentScore } = require('../scoring');

const STORIES_DIR = path.join(__dirname, '..', 'stories');
const Anthropic = require('@anthropic-ai/sdk');

// Context window: sized to hold the largest nursery rhyme + small buffer
const CONTEXT_TOKEN_LIMIT = 1700;

function loadStory(filename) {
  return fs.readFileSync(path.join(STORIES_DIR, filename), 'utf-8');
}

function loadGroundTruth() {
  return JSON.parse(fs.readFileSync(path.join(STORIES_DIR, 'ground_truth.json'), 'utf-8'));
}

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

function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

const BASE_STORIES = {
  'three_little_pigs': { file: 'three_little_pigs.txt', name: 'The Three Little Pigs', groundTruthKey: 'The Three Little Pigs' },
  'little_red_riding_hood': { file: 'little_red_riding_hood.txt', name: 'Little Red Riding Hood', groundTruthKey: 'Little Red Riding Hood' },
  'humpty_dumpty': { file: 'humpty_dumpty.txt', name: 'Humpty Dumpty', groundTruthKey: 'Humpty Dumpty' },
};

const CONTAMINATION_STORIES = [
  { file: 'cinderella.txt', name: 'Cinderella', label: 'cinderella' },
  { file: 'columbus.txt', name: 'Christopher Columbus', label: 'columbus' },
  { file: 'alamo.txt', name: 'The Alamo', label: 'alamo' },
];

/**
 * Summarize context using Claude — deliberately lossy.
 * Mimics what happens when an LLM compresses its own context window.
 */
async function summarizeContext(context, storyName) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const targetWords = Math.floor(CONTEXT_TOKEN_LIMIT / 1.3 * 0.6); // compress to 60% of limit

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: targetWords + 100,
    temperature: 0.0,
    messages: [{
      role: 'user',
      content: `Summarize the following text into approximately ${targetWords} words. Preserve the key narrative points but compress aggressively. Do NOT add commentary — only return the summary.

Text:
${context}`
    }],
  });

  return response.content[0].text;
}

function buildProgression(baseStoryKey) {
  const base = BASE_STORIES[baseStoryKey];
  const baseText = loadStory(base.file);
  const baseChapters = splitIntoChapters(baseText, 10);
  const steps = [];

  for (let i = 0; i < 10; i++) {
    steps.push({ step: i + 1, phase: 'base', phaseName: base.name, chapterNum: i + 1, chapterText: baseChapters[i], label: `${base.name} ch.${i + 1}` });
  }

  let stepNum = 11;
  for (const contam of CONTAMINATION_STORIES) {
    const contamText = loadStory(contam.file);
    const contamChapters = splitIntoChapters(contamText, 10);
    for (let i = 0; i < 10; i++) {
      steps.push({ step: stepNum++, phase: contam.label, phaseName: contam.name, chapterNum: i + 1, chapterText: contamChapters[i], label: `${contam.name} ch.${i + 1}` });
    }
  }

  return steps;
}

/**
 * Run a context-rot simulation.
 */
async function runContextRotSimulation(baseStoryKey, options = {}) {
  const { onStep, chunkSize = 300 } = options; // smaller chunks for tighter window
  const base = BASE_STORIES[baseStoryKey];
  const groundTruth = loadGroundTruth();
  const gtLessons = groundTruth[base.groundTruthKey];
  const steps = buildProgression(baseStoryKey);

  // Freeze domain terms from the base story ONLY.
  // All subsequent analysis scores chunks against these fixed terms.
  // This means the x-axis of the bell curve always answers:
  // "how much does this chunk look like the original story?"
  const baseText = loadStory(base.file);
  const fixedDomainTerms = extractDomainTerms(baseText, { chunkSize });

  // Track chapters as individual entries so we can drop oldest + resummarize
  const contextChapters = [];
  let summarizationCount = 0;
  const results = [];

  for (const step of steps) {
    // Add new chapter to the end
    contextChapters.push({ label: step.label, text: step.chapterText });

    // Build current context
    let context = contextChapters.map(c => `[${c.label}]\n${c.text}`).join('\n\n');
    let rotEvent = false;
    const tokensBefore = estimateTokens(context);

    if (tokensBefore > CONTEXT_TOKEN_LIMIT) {
      // Drop the oldest chapter
      const evicted = contextChapters.shift();

      // Resummarize the remaining context
      const remaining = contextChapters.map(c => `[${c.label}]\n${c.text}`).join('\n\n');
      context = await summarizeContext(remaining, base.name);

      // Replace all chapters with the summary as a single entry
      contextChapters.length = 0;
      contextChapters.push({ label: 'Summary (after dropping: ' + evicted.label + ')', text: context });

      summarizationCount++;
      rotEvent = true;
      const tokensAfter = estimateTokens(context);
      console.log(`    [ROT #${summarizationCount}] Dropped "${evicted.label}" + resummarized: ${tokensBefore} → ${tokensAfter} tokens`);

      // Rebuild context string from the new state
      context = contextChapters.map(c => `[${c.label}]\n${c.text}`).join('\n\n');
    }

    // Analyze against FIXED domain terms (not the current context's own terms)
    const analysis = analyzeContext(context, { chunkSize, fixedDomainTerms });

    // Derive lessons + score
    let systemLessons, vectorScore, llmJudgeScore;
    try {
      systemLessons = await deriveLessons(context, base.name, 0.3);
      vectorScore = computeAlignmentScore(systemLessons, gtLessons);
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
      contextLength: context.length,
      tokenEstimate: estimateTokens(context),
      chunkCount: analysis.summary.chunkCount,
      domainMean: analysis.domain.stats.mean,
      domainStd: analysis.domain.stats.stdDev,
      domainSkewness: analysis.domain.stats.skewness,
      domainKurtosis: analysis.domain.stats.kurtosis,
      domainHistogram: analysis.domain.stats.histogram,
      domainGaussian: analysis.domain.stats.gaussianFit,
      domainInterpretation: analysis.domain.interpretation,
      // Individual chunk scores — the actual measurements
      chunkDomainScores: analysis.chunks.map(c => c.domainScore),
      userMean: analysis.user.stats.mean,
      userStd: analysis.user.stats.stdDev,
      systemLessons,
      groundTruthLessons: gtLessons,
      vectorScore,
      llmJudgeScore,
      compositeScore: vectorScore.composite,
      rotEvent,
      summarizationCount,
      contextSnapshot: context, // store the actual context for inspection
      temperature: 0.3,
    };

    results.push(result);
    if (onStep) onStep(result);
  }

  return results;
}

module.exports = {
  runContextRotSimulation, buildProgression, BASE_STORIES,
  CONTAMINATION_STORIES, CONTEXT_TOKEN_LIMIT,
};
