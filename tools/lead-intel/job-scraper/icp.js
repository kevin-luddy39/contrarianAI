// ICP keyword scorer for job postings. Scores how well a job matches
// contrarianAI's $15K Full Diagnostic + $35K onsite ideal customer profile:
// companies hiring for production AI roles where Bell Tuning sensors are
// directly relevant.

const PAIN_KEYWORDS = [
  // Direct Bell Tuning territory
  { kw: /\brag\b|retrieval[- ]augmented/i, weight: 10, tag: 'rag' },
  { kw: /\bagent(s|ic)?\b|agentic workflow/i, weight: 10, tag: 'agent' },
  { kw: /\borchestrat/i, weight: 8, tag: 'orchestration' },
  { kw: /\beval(s|uation)?\b/i, weight: 7, tag: 'eval' },
  { kw: /\bobservability\b/i, weight: 8, tag: 'observability' },
  { kw: /\bllm[- ]?ops|mlops\b/i, weight: 6, tag: 'llmops' },
  { kw: /\bproduction\s+(ai|llm|ml)/i, weight: 8, tag: 'production-ai' },
  { kw: /\binference\b/i, weight: 5, tag: 'inference' },
  { kw: /\bvector(s)?\b|embedding/i, weight: 5, tag: 'vector' },
  { kw: /\bprompt\s+engineer/i, weight: 5, tag: 'prompt-eng' },
  { kw: /\btool[- ]call/i, weight: 7, tag: 'tool-call' },
  { kw: /\bcontext\s+(window|engineering)/i, weight: 8, tag: 'context-eng' },
  { kw: /\bmulti[- ]agent/i, weight: 9, tag: 'multi-agent' },
  { kw: /\bhallucinat/i, weight: 7, tag: 'hallucination' },
  { kw: /\bdrift\b/i, weight: 5, tag: 'drift' },
  { kw: /\breliab(le|ility)\b/i, weight: 4, tag: 'reliability' },
  { kw: /\bmcp\b|model context protocol/i, weight: 6, tag: 'mcp' },
  { kw: /\bllm\b/i, weight: 3, tag: 'llm' },
  { kw: /\bgenerat(ive|ion)\s+ai\b|gen[- ]?ai/i, weight: 3, tag: 'genai' },
  // Stack hints (lower weight)
  { kw: /\blangchain|langgraph\b/i, weight: 4, tag: 'langchain' },
  { kw: /\bllamaindex\b/i, weight: 4, tag: 'llamaindex' },
  { kw: /\bopenai|anthropic|claude\b/i, weight: 2, tag: 'closed-model' },
  { kw: /\bbraintrust|langfuse\b/i, weight: 5, tag: 'eval-tooling' },
];

const SENIORITY_KEYWORDS = [
  /\b(senior|sr\.?)\b/i,
  /\bstaff\b/i,
  /\bprincipal\b/i,
  /\blead\b/i,
  /\bhead\s+of\b/i,
  /\bvp\s+of\b/i,
  /\bdirector\b/i,
  /\barchitect\b/i,
  /\bfounding\b/i,
];

const ANTI_KEYWORDS = [
  // Skip these - body shops, recruiters, contract placements
  /\b(recruiter|talent acquisition|sourcer)\b/i,
  /\bbench\s+sales\b/i,
  /\bH1B|OPT|CPT\b/,
  /\bw2\s+only\b|\bus\s+citizen\s+only\b/i,
  /\bunpaid\s+intern/i,
  /\bcommission\s+only\b/i,
];

function scoreJob(job) {
  const haystack = [
    job.title || '',
    job.description || '',
    Array.isArray(job.tags) ? job.tags.join(' ') : (job.tags || ''),
  ].join(' ');

  // Anti-keywords nuke the score - skip body shops, recruiters
  for (const re of ANTI_KEYWORDS) {
    if (re.test(haystack)) {
      return { score: 0, tags: [], is_senior: false, anti: true };
    }
  }

  let score = 0;
  const tags = [];
  for (const { kw, weight, tag } of PAIN_KEYWORDS) {
    if (kw.test(haystack)) {
      score += weight;
      tags.push(tag);
    }
  }

  const is_senior = SENIORITY_KEYWORDS.some(re => re.test(job.title || ''));
  if (is_senior) score += 5;

  return { score, tags, is_senior, anti: false };
}

function passesIcpThreshold(scored, minScore = 10) {
  return !scored.anti && scored.score >= minScore;
}

module.exports = { scoreJob, passesIcpThreshold, PAIN_KEYWORDS, SENIORITY_KEYWORDS, ANTI_KEYWORDS };
