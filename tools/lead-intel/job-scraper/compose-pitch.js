#!/usr/bin/env node
// Phase 3 - pitch composer. Reads enriched jobs JSON, generates per-prospect
// sequencer queue files for the free-30-min-diagnostic offer with explicit
// upgrade path mention ($15K Full Diagnostic / $35K onsite).
//
// Per-prospect customization uses:
//   - The hiring job title + ICP tags as the "we noticed you're hiring X" hook
//   - One Bell Tuning angle filtered through the role's stated pain
//   - Their company description excerpt for show-we-read-the-page signal
//
// Usage:
//   node compose-pitch.js --input output/jobs-2026-05-05.enriched.json
//   node compose-pitch.js --input ... --skip-domains arize.com,arizeai.com
//   node compose-pitch.js --only-with-contact   # only prospects where Hunter returned a name (default)
//
// Output: tools/sequencer/queues/jobs-2026-05-05/<company-slug>.json files,
// each runnable via: python3 tools/sequencer/seq.py <queue-file>

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const QUEUES_DIR = path.join(REPO_ROOT, 'tools', 'sequencer', 'queues');

// Bell Tuning angle library, keyed by ICP tag. Picks the most-relevant angle
// for the prospect based on what their job posting emphasized.
const ANGLES = {
  rag: {
    pain: 'in production RAG audits I run, the recurring failure is the one where retrieval succeeds, the agent self-evals as "answered," and the chunks are rank-inverted vs actual relevance - most-relevant chunk at rank 4, response built off rank 1. Eval suites pass, customers get the wrong answer.',
    shape: 'rank ordering, score calibration, redundancy, and bimodality of the per-call alignment distribution',
  },
  agent: {
    pain: 'in production agent audits I run, the recurring failure is the one where every individual call is policy-compliant and self-reports success, but the COMPOSITION of a 5-7 call cascade drifts the working context into a distribution shape the model wasn\'t trained on. Call N returns coherent-looking but factually drifted output - no single call is "the bug."',
    shape: 'rank ordering, score calibration, redundancy, and bimodality across the cascade',
  },
  'multi-agent': {
    pain: 'in production multi-agent systems I audit, the recurring failure is the one where every individual agent call passes its own check but the CROSS-AGENT composition drifts the working context off-distribution. The system reports success at every step; the user sees the wrong outcome.',
    shape: 'distributional moments per-call AND per-cascade - rank ordering, score calibration, redundancy',
  },
  orchestration: {
    pain: 'in production orchestrated AI workflows I audit, the recurring failure is the one where each step\'s telemetry looks clean but the composition shape drifts off the distribution the model was validated against. No single step is wrong; the workflow is.',
    shape: 'distributional moments across the orchestrated step boundary',
  },
  observability: {
    pain: 'in production AI systems I audit, the recurring failure is the one where standard observability (logs, traces, metrics) shows green but the OUTPUT distribution is silently drifting off the eval-set shape. Threshold-based alerting misses it because no threshold trips.',
    shape: 'shape-of-distribution moments - rank ordering, score calibration, redundancy, bimodality - that catch drift before it manifests',
  },
  eval: {
    pain: 'in production audits I run, the recurring gap is the one where the eval suite passes 0.9+ on the test set but the production-traffic distribution is rank-inverted vs the eval distribution. The eval set was the wrong distribution; nobody notices until users flag answers as wrong.',
    shape: 'distributional moments on production traffic - rank ordering, score calibration, redundancy, bimodality',
  },
  'context-eng': {
    pain: 'in production context-managed AI systems I audit, the recurring failure is the one where the context window stays under-budget and tokens look fine, but the SHAPE of what\'s in context drifts off the distribution the model was trained on. Reliability degrades silently 10-15 turns in.',
    shape: 'distributional moments of the context window itself - rank ordering, redundancy, drift signature',
  },
  hallucination: {
    pain: 'in production AI systems I audit, the under-discussed half of "hallucination" is that the OUTPUT distribution looks structurally pathological 5-15 turns BEFORE the user sees a fabricated answer. Threshold-based hallucination detection misses this signal entirely.',
    shape: 'distributional moments - rank ordering, score calibration, redundancy, bimodality - as a leading indicator of fabrication',
  },
  inference: {
    pain: 'in production inference pipelines I audit, the recurring failure is not latency or cost but output-shape drift - the per-call distribution moves off the validation set and the threshold-based monitoring you have can\'t see it.',
    shape: 'shape-of-output distributional moments per inference batch',
  },
  'production-ai': {
    pain: 'in production AI systems I audit, the recurring end-to-end-accuracy gap is the one where every layer reports green but the composite OUTPUT distribution is silently drifting. No layer\'s monitoring is wrong individually; the composition shape is.',
    shape: 'cross-layer distributional moments - rank ordering, score calibration, redundancy, bimodality',
  },
  vector: {
    pain: 'in production vector-search RAG I audit, the under-discussed failure is the one where vector retrieval succeeds (compressed indices fast, top-K returned) but the chunks are rank-inverted vs actual relevance. Speed optimizations accelerate the wrong-chunks-fast pattern as efficiently as correct retrieval.',
    shape: 'rank ordering, score calibration, redundancy of the per-query vector distribution',
  },
};

function pickAngle(icpTags) {
  // Priority order: most-specific tag wins
  const priority = ['rag', 'multi-agent', 'agent', 'orchestration', 'context-eng', 'hallucination', 'observability', 'eval', 'inference', 'vector', 'production-ai'];
  for (const t of priority) {
    if (icpTags.includes(t) && ANGLES[t]) return { tag: t, ...ANGLES[t] };
  }
  return { tag: 'production-ai', ...ANGLES['production-ai'] };
}

function firstName(fullName) {
  if (!fullName) return 'there';
  return fullName.split(/\s+/)[0];
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function composeBody(job, contact) {
  const angle = pickAngle(job.icp_tags || []);
  const fname = firstName(contact.name);
  const role = contact.title || 'leadership';
  const senior = job.is_senior ? 'senior ' : '';

  return `Hi ${fname},

Saw the ${job.title} post for ${job.company} on ${job.source === 'hn' ? 'HN Who-is-Hiring' : job.source === 'remoteok' ? 'RemoteOK' : 'WeWorkRemotely'}. The role's framing around ${(job.icp_tags || []).slice(0, 3).join(', ')} maps onto a problem I work on in production audits, and I wanted to surface a partnership-shaped angle (not a job application - reaching you direct as ${role} since the angle is more architecture-shaped than recruiting-shaped).

What I do: ${angle.pain}

The layer that catches it is observation of ${angle.shape}. Cheap to compute, no ground-truth labels needed, runs alongside the system in production. It's not a replacement for any standard layer; it's the layer underneath that catches the cases threshold-based monitoring isn't built to see.

I built a set of OSS sensors for this. Public teardown of the LangChain RAG quickstart shows what the analysis looks like in practice (5 of 6 queries flagged):

https://github.com/kevin-luddy39/contrarianAI/tree/main/tools/retrieval-auditor/examples/langchain-quickstart-teardown

If a 30-min on whether the same distributional read adds signal to ${job.company}'s pipeline is useful, happy to do it free against a sample of your traffic. The conversation is partnership-shaped (sensors live a layer above your existing monitoring), not a sales pitch.

If the conversation surfaces something worth a deeper look, I run a $15K Full Diagnostic engagement (8-12 page report with prioritized fix list across 5 sensors, 30-min walkthrough, 7 days of follow-up Q&A) and a $35K + onsite tier when the workflow needs hands-on architecture work. Both are downstream of the free 30-min - happy to never mention them again if the free conversation doesn't surface a fit.

If now isn't right, no follow-up from me.

Kevin Luddy
contrarianAI`;
}

function composeSubject(job) {
  const angle = pickAngle(job.icp_tags || []);
  const map = {
    rag: 'Distributional read on RAG retrieval shape',
    agent: 'Distributional read on agent cascade composition',
    'multi-agent': 'Distributional read on multi-agent composition',
    orchestration: 'Distributional read on orchestrated AI step composition',
    observability: 'Complementary observability layer - shape of output distribution',
    eval: 'Distributional read on production-traffic eval-set divergence',
    'context-eng': 'Distributional read on context-window shape drift',
    hallucination: 'Leading indicator for hallucination via output-distribution shape',
    inference: 'Distributional read on inference output shape',
    'production-ai': 'Distributional read on end-to-end production AI accuracy',
    vector: 'Distributional read on vector retrieval shape',
  };
  return map[angle.tag] || 'Distributional read on AI output shape';
}

function gmailComposeUrl(toEmail, subject) {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to: toEmail, su: subject });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildQueue(job, contact) {
  const subject = composeSubject(job);
  const body = composeBody(job, contact);
  return [
    { action: 'clip', text: body },
    { action: 'open_url', url: gmailComposeUrl(contact.email, subject) },
    { action: 'wait_for_user', prompt: `Gmail compose open. To: ${contact.email}, Subject: ${subject}. Click body field. Auto-paste in 10s.` },
    { action: 'key', combo: 'ctrl+v' },
    { action: 'sleep', ms: 500 },
  ];
}

function parseArgs(argv) {
  const out = { input: null, outDir: null, onlyWithContact: true, skipDomains: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') out.input = argv[++i];
    else if (a === '--out-dir') out.outDir = argv[++i];
    else if (a === '--include-no-contact') out.onlyWithContact = false;
    else if (a === '--skip-domains') {
      argv[++i].split(',').forEach(d => out.skipDomains.add(d.trim().toLowerCase()));
    }
  }
  if (!out.input) {
    const today = new Date().toISOString().slice(0, 10);
    out.input = path.join(__dirname, 'output', `jobs-${today}.enriched.json`);
  }
  if (!out.outDir) {
    const today = new Date().toISOString().slice(0, 10);
    out.outDir = path.join(QUEUES_DIR, `jobs-${today}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const enriched = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  fs.mkdirSync(args.outDir, { recursive: true });

  const candidates = enriched
    .filter(e => !args.onlyWithContact || e.contact)
    .filter(e => !args.skipDomains.has((e._derived_domain || '').toLowerCase()));

  console.log(`[compose] input: ${args.input} (${enriched.length} jobs, ${candidates.length} candidates after filters)`);
  console.log(`[compose] out-dir: ${args.outDir}`);
  console.log('');

  const written = [];
  for (const job of candidates) {
    if (!job.contact) {
      console.log(`  SKIP ${job.company} (no contact)`);
      continue;
    }
    const queue = buildQueue(job, job.contact);
    const slug = slugify(job.company);
    const outPath = path.join(args.outDir, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(queue, null, 2));
    written.push({ company: job.company, contact: job.contact, file: outPath });
    console.log(`  WROTE ${path.relative(REPO_ROOT, outPath)} -> ${job.contact.name} <${job.contact.email}>`);
  }

  console.log('');
  console.log(`[compose] wrote ${written.length} sequencer queue files`);
  console.log('');
  console.log('Run each via:');
  for (const w of written) {
    console.log(`  python3 ${path.relative(REPO_ROOT, w.file)}   # ${w.company} -> ${w.contact.name}`);
  }
}

main();
