/**
 * Scoring system — converts lessons to vectors for numerical comparison.
 *
 * Uses TF-IDF vectorization + cosine similarity for a deterministic
 * 0.00-1.00 alignment score. Also provides the LLM-as-judge score
 * from llm.js for richer comparison.
 */

const { tokenize: coreTokenize } = require('../core');

// Simple tokenizer without stemming for scoring (preserves original words)
function tokenizeForScoring(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Build TF-IDF vector from text against a shared vocabulary.
 */
function buildVocabulary(texts) {
  const df = {};
  const N = texts.length;
  texts.forEach(text => {
    const unique = new Set(tokenizeForScoring(text));
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  // IDF
  const vocab = {};
  let idx = 0;
  for (const [term, count] of Object.entries(df)) {
    vocab[term] = { index: idx++, idf: Math.log((N + 1) / (count + 1)) + 1 };
  }
  return vocab;
}

function textToVector(text, vocab) {
  const tokens = tokenizeForScoring(text);
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const vec = new Float64Array(Object.keys(vocab).length);
  for (const [term, count] of Object.entries(tf)) {
    if (vocab[term]) {
      vec[vocab[term].index] = (count / tokens.length) * vocab[term].idf;
    }
  }
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return (magA && magB) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

/**
 * Compute TF-IDF cosine similarity between two texts.
 * Returns 0.00 - 1.00.
 */
function vectorAlignmentScore(textA, textB) {
  const vocab = buildVocabulary([textA, textB]);
  const vecA = textToVector(textA, vocab);
  const vecB = textToVector(textB, vocab);
  return Math.max(0, Math.min(1, cosineSim(vecA, vecB)));
}

/**
 * Extract individual lesson statements from numbered list text.
 */
function parseLessons(text) {
  const lines = text.split('\n').filter(l => l.trim());
  return lines
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length > 10);
}

/**
 * Compute a composite alignment score using multiple methods:
 * 1. Full-text cosine similarity (TF-IDF)
 * 2. Per-lesson best-match scoring
 * 3. Concept overlap (key noun counting)
 *
 * Returns { composite, tfidfScore, lessonMatchScore, conceptOverlap }
 */
function computeAlignmentScore(systemLessons, groundTruthLessons) {
  // 1. Full-text TF-IDF cosine
  const tfidfScore = vectorAlignmentScore(systemLessons, groundTruthLessons);

  // 2. Per-lesson best match
  const sysLines = parseLessons(systemLessons);
  const gtLines = parseLessons(groundTruthLessons);

  let totalBestMatch = 0;
  if (sysLines.length > 0 && gtLines.length > 0) {
    for (const sysLesson of sysLines) {
      let best = 0;
      for (const gtLesson of gtLines) {
        const sim = vectorAlignmentScore(sysLesson, gtLesson);
        if (sim > best) best = sim;
      }
      totalBestMatch += best;
    }
    totalBestMatch /= sysLines.length;
  }
  const lessonMatchScore = totalBestMatch;

  // 3. Concept overlap (extract key nouns, measure Jaccard)
  const sysTokens = new Set(tokenizeForScoring(systemLessons));
  const gtTokens = new Set(tokenizeForScoring(groundTruthLessons));
  const intersection = new Set([...sysTokens].filter(t => gtTokens.has(t)));
  const union = new Set([...sysTokens, ...gtTokens]);
  const conceptOverlap = union.size > 0 ? intersection.size / union.size : 0;

  // Composite: weighted average
  const composite = tfidfScore * 0.4 + lessonMatchScore * 0.4 + conceptOverlap * 0.2;

  return {
    composite: Math.round(composite * 1000) / 1000,
    tfidfScore: Math.round(tfidfScore * 1000) / 1000,
    lessonMatchScore: Math.round(lessonMatchScore * 1000) / 1000,
    conceptOverlap: Math.round(conceptOverlap * 1000) / 1000,
  };
}

module.exports = { computeAlignmentScore, vectorAlignmentScore, parseLessons };
