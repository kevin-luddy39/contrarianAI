/**
 * LLM integration — Anthropic Claude for lessons derivation.
 * Supports multiple temperature settings for comparison runs.
 */

const Anthropic = require('@anthropic-ai/sdk');

const API_KEY = process.env.ANTHROPIC_API_KEY;

function getClient() {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: API_KEY });
}

/**
 * Derive lessons learned from accumulated story context.
 * @param {string} context - The accumulated text (story chapters + any contamination)
 * @param {string} storyName - The target story name (e.g., "Three Little Pigs")
 * @param {number} temperature - LLM temperature (0.0 - 1.0)
 * @returns {Promise<string>} - Lessons learned text
 */
async function deriveLessons(context, storyName, temperature = 0.3) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    temperature,
    messages: [{
      role: 'user',
      content: `You are analyzing the following text context. The primary story is "${storyName}".

Based on the context below, identify the key lessons learned, morals, and takeaways from "${storyName}". Focus ONLY on lessons from "${storyName}" — ignore unrelated content that may be mixed in.

Return exactly 5 lessons, numbered 1-5. Each lesson should be one clear sentence.

Context:
${context}`
    }],
  });

  return response.content[0].text;
}

/**
 * Use Claude as judge to score alignment between two sets of lessons.
 * Returns a score from 0.00 to 1.00.
 */
async function judgeLessonsAlignment(systemLessons, groundTruthLessons, storyName, temperature = 0.0) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    temperature,
    messages: [{
      role: 'user',
      content: `You are evaluating how well System-Generated lessons match the accepted Ground Truth lessons for "${storyName}".

Ground Truth Lessons:
${groundTruthLessons}

System-Generated Lessons:
${systemLessons}

Score the alignment from 0.00 to 1.00 where:
- 1.00 = perfect match (all key concepts captured correctly)
- 0.75 = good (most concepts captured, minor differences)
- 0.50 = partial (some correct concepts, some missing or wrong)
- 0.25 = poor (few concepts match, significant drift)
- 0.00 = no alignment (completely wrong or unrelated)

Respond with ONLY a JSON object: {"score": 0.XX, "reasoning": "one sentence explanation"}`
    }],
  });

  const text = response.content[0].text;
  try {
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        score: Math.max(0, Math.min(1, parseFloat(parsed.score) || 0)),
        reasoning: parsed.reasoning || '',
      };
    }
  } catch { /* fallback */ }

  // Fallback: try to extract a number
  const numMatch = text.match(/0\.\d+/);
  return {
    score: numMatch ? parseFloat(numMatch[0]) : 0.5,
    reasoning: text.slice(0, 200),
  };
}

module.exports = { deriveLessons, judgeLessonsAlignment };
