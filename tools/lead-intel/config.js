// Central config for lead-intel.
// Keep targets here so the collector, scheduler, and dashboard agree.

const OWNER = 'kevin-luddy39';

// Public GitHub repos we monitor. The other npm packages
// (predictor-corrector, retrieval-auditor, tool-call-grader, audit-report-generator,
//  bell-tuning-cloud) live inside the contrarianAI monorepo as subdirectories
// (see tools/<pkg>/package.json → directory field). They don't have standalone
// GitHub traffic pages — traffic for them rolls up into contrarianAI.
const REPOS = [
  { owner: OWNER, repo: 'contrarianAI', primary: true },
  { owner: OWNER, repo: 'context-inspector', primary: true },
];

const NPM_PACKAGES = [
  'contrarianai-context-inspector',
  'contrarianai-predictor-corrector',
  'contrarianai-retrieval-auditor',
  'contrarianai-tool-call-grader',
  'contrarianai-audit-report-generator',
];

// Engagement score weights — tuned for AI/dev-tool funnel.
// Higher weight = stronger intent signal.
const SCORE_WEIGHTS = {
  star: 5,
  watcher: 8,
  fork: 12,
  issue_author: 18,
  pr_author: 25,
  landing_visit: 1,
  assessment_start: 10,
  assessment_submit: 25,
  audit_request: 60,
  payment: 200,
};

// ICP signal keywords — bio/company regex hits add to icp_fit.
const ICP_KEYWORDS = [
  { rx: /\b(staff|principal|senior|lead|head|director|vp|cto|chief)\b/i, weight: 8, label: 'seniority' },
  { rx: /\b(ml|ai|llm|rag|agent|mlops|data|platform)\b/i, weight: 10, label: 'ai-adjacent' },
  { rx: /\b(founder|co-?founder|entrepreneur)\b/i, weight: 12, label: 'founder' },
  { rx: /\b(enterprise|platform|infra|infrastructure|devtools?|sre)\b/i, weight: 5, label: 'platform' },
];

// ICP anti-signal keywords — deduct.
const ANTI_KEYWORDS = [
  { rx: /\b(student|intern|learning|tutorial)\b/i, weight: -6, label: 'student' },
  { rx: /\b(recruiter|talent|sourcer)\b/i, weight: -10, label: 'recruiter' },
];

// Refresh cadences (min seconds between collector runs of each kind).
const CADENCES = {
  piggyback: 10 * 60,         // 10 min: lightweight (stars only) when ping hits
  traffic: 6 * 60 * 60,       // 6 h: traffic (14d window, snapshot aggressively)
  stars: 60 * 60,             // 1 h: new stargazers
  watchers: 6 * 60 * 60,      // 6 h
  forks: 6 * 60 * 60,         // 6 h
  issues: 6 * 60 * 60,        // 6 h
  profiles: 24 * 60 * 60,     // 24 h: re-enrich profiles (rarely changes)
  npm: 6 * 60 * 60,           // 6 h
};

module.exports = { OWNER, REPOS, NPM_PACKAGES, SCORE_WEIGHTS, ICP_KEYWORDS, ANTI_KEYWORDS, CADENCES };
