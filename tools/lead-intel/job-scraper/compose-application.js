#!/usr/bin/env node
// Application-intent composer. Reads the application-candidates JSON,
// generates per-job tailoring memos in markdown that Kevin reviews before
// clicking Apply.
//
// Each memo includes:
//   - Apply URL + role facts
//   - Which Kevin-roles best match (auto-mapped from app_tags)
//   - Skills/projects to emphasize on resume + cover letter top-line
//   - Cover letter draft (always provided; Kevin edits or skips)
//   - Application notes (stealth flags, resume path)
//
// Usage:
//   node compose-application.js --input output/applications-2026-05-05.json
//   node compose-application.js --top 10  # only top N by app_score

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// Map app_tags to Kevin's recent roles + projects to highlight. Per
// kevin_profile_for_job_search.md.
const ROLE_HIGHLIGHTS = {
  'ai-arch':    ['contrarianAI Bell Tuning research lead', 'NexTech AI Architect (XRP crypto POS)', 'Mercola IT AI Architect (Health Coach app, Qdrant RAG, agentic LLM)'],
  'ml-eng':     ['contrarianAI Bell Tuning sensors (5 OSS npm packages)', 'Mercola IT Health Coach (multi-classifier MCP, Qdrant RAG)'],
  'rag-eng':    ['retrieval-auditor (unsupervised RAG health, r=0.999 vs precision@5 without ground truth)', 'LangChain RAG quickstart teardown (5/6 queries flagged)', 'Mercola IT Qdrant RAG for Dr. Mercola corpus'],
  'llm-eng':    ['contrarianAI context-inspector (MCP-aware LLM context degradation sensor)', 'Mercola IT LLM model selection rig (cost/perf comparison)'],
  'agent-eng':  ['contrarianAI tool-call-grader (multi-agent failure detection, 7/7 scenarios)', 'Mercola IT cloud-centric AI agentic architecture'],
  'sw-arch':    ['Oculearn CTO/Architect 24 yrs (Python+FastAPI+PostgreSQL clinical SaaS, HL7 FHIR)', 'iDox Solutions architect (Power Platform / Dataverse migration)', 'Verizon REST microservices architecture'],
  'principal':  ['Oculearn CTO 24 yrs', 'Xerox principal .Net dev (XCM call center)', 'Verizon Sr Java microservices lead'],
  'staff-eng':  ['Lockheed Martin Sr SWE (genBOE, Proposal Tracking)', 'Oculearn CTO/Tech Lead'],
  'tech-lead':  ['Oculearn Tech Lead 24 yrs', 'iDox Solutions custom tools cutover lead', 'ITnova Sr Lead Dev (MD State Police, MD DoH)'],
  'founding-eng': ['Oculearn LLC sole technical founder 24 yrs', 'contrarianAI sole technical founder', 'StreamTech Engineering UI design lead'],
  'cto':        ['Oculearn CTO/Product Architect 24 yrs', 'contrarianAI AI Architect/Researcher Lead'],
  'vp-eng':     ['Oculearn CTO 24 yrs (full org responsibility)'],
  'head-of':    ['Oculearn CTO 24 yrs', 'contrarianAI Lead'],
  'director':   ['Oculearn CTO 24 yrs', 'iDox Solutions architect/lead'],
  'dotnet':     ['Lockheed Martin Sr SWE (.Net 4.8 + AngularJS + PrimeNG + NgRx)', 'iDox Solutions (.Net Core 8/9 + C# + TypeScript)', 'ITnova Sr Lead .Net Core (.Net Core REST microservices, EF, TDD)', 'Xerox principal .Net dev', 'Bechtel/American Red Cross/JobFox/etc — 25+ yr .Net experience'],
  'python':     ['Oculearn (Python+FastAPI clinical SaaS)', 'contrarianAI Bell Tuning sensors (Python core)', 'NexTech XRP POS (Python demo UI + test harness)', 'Mercola IT (Python LLM apps)'],
  'js':         ['Oculearn (vanilla JS, jQuery, AngularJS, ReactJS, mobile PWA)', 'NexTech (Spring Boot + Python + JS)'],
  'sql':        ['Oculearn (PostgreSQL prod migration from SQLite)', '25+ yr MS SQL Server (Verizon, Lockheed, iDox, ITnova, Mercola)', 'Oracle/MySQL experience'],
  'ai-stack':   ['Daily Claude Code driver', 'Mercola IT OpenAI integration', 'NexTech Claude Code productivity'],
  'rag-stack':  ['retrieval-auditor (Bell Tuning RAG sensor)', 'Mercola IT Qdrant RAG', 'LangChain RAG quickstart teardown'],
  'mcp':        ['contrarianAI context-inspector (MCP-aware sensor)', 'Mercola IT multi-classifier MCP'],
  'agent-stack':['contrarianAI tool-call-grader', 'Mercola IT agentic LLM architecture'],
  'healthcare': ['Oculearn CTO 24 yrs (HIPAA-aware clinical SaaS, HL7 FHIR, vision therapy)', 'NORC OMH Performance Data System'],
  'defense':    ['Rockwell Collins (Navy E2C Hawkeye CEC simulation)', 'JHU/APL (CEC integration, sonar systems)', 'CAE-Link (Navy sonar trainers)'],
  'gov':        ['Multiple federal/state contracts: Census, DOE, DOI, MD State Police, MD DoH, Cherokee Information Systems'],
};

const ANGLE_TEMPLATES = {
  'ai-arch': "I've been doing AI architecture work since 2024 — most recently leading Bell Tuning research at contrarianAI (5 OSS sensors detecting AI-system failure shape before it manifests in output) and previously at Mercola IT (agentic LLM architecture with multi-classifier MCP and Qdrant RAG for Dr. Mercola's published corpus).",
  'ml-eng': "My recent ML engineering work: 5 OSS sensor packages I shipped through contrarianAI (statistical detection of context drift, retrieval pathology, agent cascade failure), and Mercola IT's Health Coach app with cost/performance LLM model rig.",
  'rag-eng': "On RAG specifically: I built retrieval-auditor (unsupervised health score that tracks precision@5 at r=0.999 without ground-truth labels, with six pathology flags including score miscalibration and rank inversion). Public teardown of LangChain's RAG quickstart shipped recently — 5 of 6 on-topic queries flagged.",
  'llm-eng': "I run Claude Code daily as my development environment and ship LLM-using software — most recently contrarianAI Bell Tuning sensors (5 OSS npm packages, MCP-aware) and the Mercola IT Health Coach with multi-classifier MCP and Qdrant RAG.",
  'agent-eng': "I build multi-agent systems and the diagnostic tooling around them. Recently shipped tool-call-grader (six-pathology multi-agent failure detector, 7/7 scenarios pass on hand-designed benchmark, zero false positives on healthy 12-call workflow). Earlier at Mercola IT I tweaked their cloud-centric agentic architecture.",
  'sw-arch': "I've architected production software for 35+ years across stacks (.Net Core, Python+FastAPI, Java+Spring Boot, embedded C/C++) and verticals (clinical SaaS, defense simulation, fintech, federal). Most recently as CTO/architect at Oculearn for 24 years building HIPAA-aware vision-therapy SaaS, and now as AI Architect at contrarianAI.",
  'principal': "Principal-level work across 35+ years — including 24 yrs as Oculearn CTO/architect (full clinical SaaS lifecycle), Xerox principal .Net dev on XCM, and Verizon Sr Java microservices lead.",
  'staff-eng': "Senior/Staff-level recent work: Lockheed Martin Sr SWE (.Net 4.8 + AngularJS proposal management) and Oculearn CTO/Tech Lead 24 yrs.",
  'tech-lead': "Tech lead experience across 24 yrs at Oculearn (sole technical founder) plus multiple lead roles (iDox Solutions cutover, ITnova on MD State Police + MD DoH).",
  'founding-eng': "I've been a sole technical founder twice — Oculearn LLC for 24 years (clinical vision-therapy SaaS, full lifecycle from first commit through production HIPAA deployment) and now contrarianAI (AI observability sensors).",
  'cto': "CTO/Product Architect at Oculearn for 24 years (HIPAA-aware clinical SaaS, full org responsibility) and now AI Architect Lead at contrarianAI.",
  'dotnet': "Deep C#/.Net history: 25+ years across .Net Framework + .Net Core (versions 2.0 through 9), recently at Lockheed Martin (.Net 4.8 + AngularJS + PrimeNG + NgRx) and iDox Solutions (.Net Core 8/9 + C# + TypeScript on Power Platform migration).",
  'python': "Python in production: Oculearn FastAPI/PostgreSQL clinical SaaS, contrarianAI Bell Tuning sensors, NexTech XRP POS demo + test harness, Mercola IT LLM apps.",
  'healthcare': "I've shipped HIPAA-aware clinical SaaS for 24 years at Oculearn — vision therapy platform with HL7 FHIR data models, real-time multiplayer therapy sessions, AI clinical scoring, full enterprise admin and security hardening, 325-step automated test suite.",
  'defense': "Earlier in my career I worked on defense and aerospace simulation systems — Rockwell Collins Navy E2C Hawkeye CEC simulation lead, JHU/APL CEC integration, CAE-Link Navy sonar trainers (multi-threaded Ada/SGI graphics, FORTRAN/parallax, real-time signal generation).",
};

function pickAngle(appTags) {
  const priority = ['ai-arch', 'ml-eng', 'rag-eng', 'llm-eng', 'agent-eng', 'cto', 'sw-arch', 'principal', 'staff-eng', 'tech-lead', 'founding-eng', 'dotnet', 'python', 'healthcare', 'defense'];
  for (const t of priority) {
    if (appTags.includes(t) && ANGLE_TEMPLATES[t]) return { tag: t, text: ANGLE_TEMPLATES[t] };
  }
  return { tag: 'sw-arch', text: ANGLE_TEMPLATES['sw-arch'] };
}

function pickHighlights(appTags) {
  const out = [];
  const seen = new Set();
  // Tags ordered by weight (biggest first via app_score implicit ordering)
  for (const t of appTags) {
    const items = ROLE_HIGHLIGHTS[t] || [];
    for (const item of items) {
      if (!seen.has(item)) { seen.add(item); out.push(item); }
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function composeMemo(job) {
  const angle = pickAngle(job.app_tags || []);
  const highlights = pickHighlights(job.app_tags || []);
  const geoFlag = job._geo?.flag ? ` [${job._geo.flag}]` : '';
  const applyUrl = job.apply_url || job.url || '(no apply URL — check job posting)';

  const cover = `Hi ${job.company} hiring team,

I'm applying for the ${job.title} role.

${angle.text}

What drew me to ${job.company}: the role description (${(job.app_tags || []).slice(0, 4).join(', ')}) maps to work I've shipped recently and architecture decisions I've owned end-to-end.

I'm based in Castle Hayne NC; remote works well for me, and I'm open to ${job._geo?.reason === 'remote' ? 'fully remote' : 'hybrid/onsite within 2-hour commute (this role qualifies)'}.

Resume + a few of the OSS projects mentioned above attached / linked. Happy to walk through any of the work in a call.

Kevin Luddy
Castle Hayne, NC
github.com/kevin-luddy39`;

  return `# ${job.company} | ${job.title}

**Apply:** ${applyUrl}
**Posted:** ${(job.posted_at || '').slice(0, 10) || '?'} | **Source:** ${job.source} | **Score:** ${job.app_score}
**Location:** ${job.location || '?'} | **Geo:** ${job._geo?.reason || '?'}${geoFlag}
**Match tags:** ${(job.app_tags || []).join(', ')}

## Resume sections to emphasize

${highlights.map(h => `- ${h}`).join('\n')}

## Cover-letter draft (edit before sending)

${cover}

## Apply notes

- Resume file: \`C:\\Users\\luddy\\Downloads\\Kevin Luddy resume 20260502 - with AI research.docx\`
- Stealth: company NOT in active outreach window as of scrape time. Verify before applying if reply has come in since.
- Geo flag: ${job._geo?.flag || 'none'}
- Time-to-apply estimate: 5-15 min (depends on portal)

---

## Job description (excerpt)

${cleanDescription(job.description || '').slice(0, 1500)}${(job.description || '').length > 1500 ? '...' : ''}
`;
}

function cleanDescription(html) {
  return html
    // Strip script/style blocks
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Strip all tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'").replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs(argv) {
  const out = { input: null, outDir: null, top: 30 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') out.input = argv[++i];
    else if (a === '--out-dir') out.outDir = argv[++i];
    else if (a === '--top') out.top = parseInt(argv[++i], 10);
  }
  if (!out.input) {
    const today = new Date().toISOString().slice(0, 10);
    out.input = path.join(__dirname, 'output', `applications-${today}.json`);
  }
  if (!out.outDir) {
    const today = new Date().toISOString().slice(0, 10);
    out.outDir = path.join(__dirname, 'output', `applications-${today}-memos`);
  }
  return out;
}

function buildQueue(job) {
  const cover = composeMemo(job).match(/## Cover-letter draft \(edit before sending\)\n\n([\s\S]*?)\n\n## Apply notes/)?.[1] || '';
  const url = job.apply_url || job.url;
  return [
    { action: 'clip', text: cover.trim() },
    { action: 'open_url', url },
    { action: 'wait_for_user', prompt: `Job listing open. Click the APPLY button on the page → company portal opens. Cover letter is in clipboard (Ctrl+V where needed). Don't forget to attach resume. Auto-pause 15s, you don't need to do anything here.`, fallback_sleep_ms: 15000 },
  ];
}

function main() {
  const args = parseArgs(process.argv);
  const jobs = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  fs.mkdirSync(args.outDir, { recursive: true });
  const queuesDir = path.join(REPO_ROOT, 'tools', 'sequencer', 'queues', `applications-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(queuesDir, { recursive: true });

  const sorted = jobs.slice().sort((a, b) => (b.app_score || 0) - (a.app_score || 0));
  const top = sorted.slice(0, args.top);
  console.log(`[compose-app] writing ${top.length} memos to ${args.outDir}`);
  console.log(`[compose-app] writing ${top.length} sequencer queues to ${queuesDir}`);

  // Index file
  const indexLines = [
    `# Application memos — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Top ${top.length} candidates from ${jobs.length} scraped. Ranked by application-ICP score.`,
    '',
    '| # | Score | Company | Role | Geo | Memo | Sequencer queue |',
    '|---|---|---|---|---|---|---|',
  ];
  for (let i = 0; i < top.length; i++) {
    const j = top[i];
    const slug = slugify(`${j.company}-${j.title}`);
    const memoPath = path.join(args.outDir, `${slug}.md`);
    fs.writeFileSync(memoPath, composeMemo(j));
    // Sequencer queue file
    const queuePath = path.join(queuesDir, `${slug}.json`);
    fs.writeFileSync(queuePath, JSON.stringify(buildQueue(j), null, 2));
    indexLines.push(`| ${i + 1} | ${j.app_score} | ${j.company} | ${(j.title || '').slice(0, 50)} | ${j._geo?.reason || '?'} | [memo](${slug}.md) | \`${path.relative(REPO_ROOT, queuePath)}\` |`);
  }
  fs.writeFileSync(path.join(args.outDir, 'INDEX.md'), indexLines.join('\n') + '\n');
  console.log(`[compose-app] index: ${path.relative(REPO_ROOT, path.join(args.outDir, 'INDEX.md'))}`);
  console.log('');
  console.log('Top 5 (open the memo file then click Apply URL):');
  for (let i = 0; i < Math.min(5, top.length); i++) {
    const j = top[i];
    console.log(`  ${j.app_score}  ${j.company} | ${(j.title || '').slice(0, 50)}`);
  }
}

main();
