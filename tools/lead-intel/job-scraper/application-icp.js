// ICP scoring for the APPLICATION-intent path. Different from outreach-icp.
// Scores how well a job matches Kevin's profile (per kevin_profile_for_job_search.md):
// AI-architect/ML-engineer roles preferred, but any senior SWE in his stack OK.

const SKILL_KEYWORDS = [
  // Highest weight: AI architect / AI lead roles
  { kw: /\bai\s+(architect|lead|engineer|researcher)\b/i, weight: 20, tag: 'ai-arch' },
  { kw: /\bml\s+(engineer|architect|lead)\b/i, weight: 18, tag: 'ml-eng' },
  { kw: /\b(rag|retrieval[- ]augmented)\s+engineer\b/i, weight: 18, tag: 'rag-eng' },
  { kw: /\bllm\s+(engineer|architect)\b/i, weight: 18, tag: 'llm-eng' },
  { kw: /\b(agent|agentic)\s+(engineer|architect)\b/i, weight: 18, tag: 'agent-eng' },
  // Senior generalist roles where Kevin can voice on architecture
  { kw: /\b(software|systems?|solutions?)\s+architect\b/i, weight: 15, tag: 'sw-arch' },
  { kw: /\bprincipal\s+(engineer|developer)\b/i, weight: 14, tag: 'principal' },
  { kw: /\bstaff\s+engineer\b/i, weight: 14, tag: 'staff-eng' },
  { kw: /\btech(nical)?\s+lead\b/i, weight: 13, tag: 'tech-lead' },
  { kw: /\bfounding\s+engineer\b/i, weight: 14, tag: 'founding-eng' },
  { kw: /\b(cto|chief\s+technology)\b/i, weight: 16, tag: 'cto' },
  { kw: /\bvp\s+(of\s+)?eng/i, weight: 15, tag: 'vp-eng' },
  { kw: /\bhead\s+of\s+(eng|ai|ml|product)\b/i, weight: 14, tag: 'head-of' },
  { kw: /\bdirector\s+of\s+(eng|ai|ml)\b/i, weight: 13, tag: 'director' },
  // Stack alignment (Kevin's deep stack)
  { kw: /\b(c#|\.net|dotnet)\b/i, weight: 8, tag: 'dotnet' },
  { kw: /\b(python|fastapi)\b/i, weight: 8, tag: 'python' },
  { kw: /\b(typescript|javascript|react|angular)\b/i, weight: 5, tag: 'js' },
  { kw: /\b(postgres|postgresql|sql\s+server|t-sql)\b/i, weight: 5, tag: 'sql' },
  { kw: /\b(claude|anthropic|openai|llm|gpt)\b/i, weight: 6, tag: 'ai-stack' },
  { kw: /\b(rag|retrieval|embedding|vector)\b/i, weight: 7, tag: 'rag-stack' },
  { kw: /\b(mcp|model context protocol)\b/i, weight: 8, tag: 'mcp' },
  { kw: /\b(agent|orchestration|cascade)\b/i, weight: 7, tag: 'agent-stack' },
  // Domain alignment (Kevin's prior verticals)
  { kw: /\b(hipaa|hl7|fhir|clinical|healthcare|medical)\b/i, weight: 6, tag: 'healthcare' },
  { kw: /\b(defense|dod|aerospace|simulation|embedded)\b/i, weight: 4, tag: 'defense' },
  { kw: /\b(government|federal|gov|secret\s+clearance)\b/i, weight: 4, tag: 'gov' },
  // Senior signal
  { kw: /\b(senior|sr\.?|staff|principal|lead|head|director|vp)\b/i, weight: 4, tag: 'senior' },
];

const ANTI_KEYWORDS = [
  // Skip junior / entry-level
  { kw: /\b(junior|jr\.?)\s+(engineer|developer|programmer)\b/i, reason: 'junior' },
  { kw: /\bentry[- ]level\b/i, reason: 'entry-level' },
  { kw: /\b(intern|internship)\b/i, reason: 'intern' },
  { kw: /\bnew\s+grad/i, reason: 'new-grad' },
  { kw: /\b0[- ]?[123]\s+years?\s+experience\b/i, reason: 'low-yoe' },
  { kw: /\b(graduate|early[- ]career)\s+program\b/i, reason: 'grad-program' },
  // Skip body shops / contract placements / commission only
  { kw: /\bcommission[- ]only\b/i, reason: 'commission-only' },
  { kw: /\b1099\s+only\b/i, reason: '1099-only' },
  { kw: /\bbench\s+sales\b/i, reason: 'bench-sales' },
  { kw: /\bcorp[- ]to[- ]corp\s+only\b|\bc2c\s+only\b/i, reason: 'c2c-only' },
  { kw: /\b(must\s+be\s+)?us\s+citizen\s+only\b/i, reason: 'citizenship-locked' },
  { kw: /\bsecret\s+clearance\s+(required|active)\b/i, reason: 'clearance-required' },
  { kw: /\btop\s+secret\s+clearance/i, reason: 'ts-clearance' },
  // Skip recruiter posts
  { kw: /\b(recruiter|talent\s+acquisition|sourcer)\s+(role|position)\b/i, reason: 'recruiter-role' },
];

// Title-only anti-keywords. Apply ONLY to the job title (not description),
// to filter roles outside Kevin's wheelhouse even when the description
// mentions some matching tech.
const TITLE_ANTI_KEYWORDS = [
  { kw: /\b(marketing|sales|business\s+development|bd\b|bdr\b|sdr\b|account\s+executive|account\s+manager|customer\s+success)\b/i, reason: 'non-engineering-role' },
  { kw: /\b(designer|ux|ui)\b(?!.*engineer)/i, reason: 'design-role' },
  { kw: /\b(product\s+manager|pm\b)\b(?!.*engineer)/i, reason: 'product-mgr-not-eng' },
  { kw: /\b(content|copy|writer|editor)\b/i, reason: 'content-role' },
  { kw: /\b(operations|operator|technician)\b(?!.*engineer)/i, reason: 'ops-role' },
  { kw: /\b(hr|human\s+resources|people\s+ops|talent)\b(?!.*engineer)/i, reason: 'hr-role' },
  { kw: /\b(finance|accountant|bookkeeper|controller)\b/i, reason: 'finance-role' },
  { kw: /\b(legal|paralegal|compliance\s+officer)\b/i, reason: 'legal-role' },
];

function scoreJobForApplication(job) {
  const title = job.title || '';
  const haystack = [
    title, job.description || '',
    Array.isArray(job.tags) ? job.tags.join(' ') : (job.tags || ''),
  ].join(' ');

  // Title-only anti: catch non-engineering roles (marketing, sales, design, etc.)
  for (const { kw, reason } of TITLE_ANTI_KEYWORDS) {
    if (kw.test(title)) return { score: 0, tags: [], anti: true, reason };
  }

  // Body-wide anti: junior, body-shop, citizenship-locked, etc.
  for (const { kw, reason } of ANTI_KEYWORDS) {
    if (kw.test(haystack)) return { score: 0, tags: [], anti: true, reason };
  }

  let score = 0;
  const tags = [];
  for (const { kw, weight, tag } of SKILL_KEYWORDS) {
    if (kw.test(haystack)) {
      score += weight;
      tags.push(tag);
    }
  }
  return { score, tags, anti: false };
}

module.exports = { scoreJobForApplication, SKILL_KEYWORDS, ANTI_KEYWORDS, TITLE_ANTI_KEYWORDS };
