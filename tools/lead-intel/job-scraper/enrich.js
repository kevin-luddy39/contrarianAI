#!/usr/bin/env node
// Phase 2 — enrich filtered jobs with Hunter.io contact lookups.
// For each unique company in jobs JSON, derive a domain, query Hunter,
// pick the best founder/CTO/VP-Eng match, and produce an enriched
// per-job record ready for Phase 3 (email composer).
//
// Usage:
//   node enrich.js --input output/jobs-2026-05-05.json --dry-run    # preview cost only
//   node enrich.js --input output/jobs-2026-05-05.json --confirm    # actually call Hunter
//   node enrich.js --input ... --max 10                             # cap calls (default 25 = free tier)
//
// Hunter free tier = 25 domain-search calls per month. Be deliberate.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { deriveDomain: smartDerive } = require('./derive-domain');

const KEY_PATHS = [
  process.env.HUNTER_API_KEY ? null : null,  // env wins below if set
  path.join(os.homedir(), '.config/contrarianai/hunter.key'),
  path.join(__dirname, '../../../.config/hunter.key.txt'),
  path.join(__dirname, '../../../.config/hunter.key'),
  '/tmp/hunterkey',
];

function getKey() {
  if (process.env.HUNTER_API_KEY) return process.env.HUNTER_API_KEY.trim();
  for (const p of KEY_PATHS) {
    if (!p) continue;
    try { return fs.readFileSync(p, 'utf8').trim(); } catch {}
  }
  throw new Error('No HUNTER_API_KEY env var and no key file at known paths');
}

const ROLE_PRIORITY = [
  { re: /\b(founder|co-?founder)\b/i, score: 100 },
  { re: /\bceo\b|chief executive/i, score: 95 },
  { re: /\bcto\b|chief technology/i, score: 90 },
  { re: /\bvp\s+(of\s+)?eng/i, score: 85 },
  { re: /\bhead\s+of\s+(eng|product|ai|ml)/i, score: 80 },
  { re: /\bvp\s+product/i, score: 70 },
  { re: /\bdirector\s+of\s+(eng|ai|ml|product)/i, score: 65 },
  { re: /\bprincipal\s+engineer/i, score: 60 },
  { re: /\bstaff\s+engineer/i, score: 55 },
  { re: /\bengineering\s+manager/i, score: 50 },
];

function scorePosition(pos) {
  const s = (pos || '').toLowerCase();
  for (const { re, score } of ROLE_PRIORITY) if (re.test(s)) return score;
  return 0;
}

// Domain derivation now lives in derive-domain.js (multi-slug variants +
// description-text URL extraction + HEAD-check verification).
async function deriveDomain(job) {
  const r = await smartDerive(job, { verify: true });
  return r.domain;
}

async function hunterDomainSearch(domain, key) {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 160)}` };
  }
  const json = await res.json();
  return { ok: true, data: json.data };
}

function pickBestContact(emails) {
  let best = null;
  let bestScore = -1;
  for (const e of emails || []) {
    const s = scorePosition(e.position);
    if (s > bestScore) {
      bestScore = s;
      best = { ...e, role_score: s };
    }
  }
  return bestScore > 0 ? best : null;
}

function parseArgs(argv) {
  const out = { input: null, output: null, dryRun: false, confirm: false, max: 25 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') out.input = argv[++i];
    else if (a === '--output' || a === '-o') out.output = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--confirm') out.confirm = true;
    else if (a === '--max') out.max = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node enrich.js --input <jobs.json> [--dry-run | --confirm] [--max 25]');
      process.exit(0);
    }
  }
  if (!out.input) {
    const today = new Date().toISOString().slice(0, 10);
    out.input = path.join(__dirname, 'output', `jobs-${today}.json`);
  }
  if (!out.output) {
    out.output = out.input.replace(/\.json$/, '.enriched.json');
  }
  if (!out.dryRun && !out.confirm) out.dryRun = true;
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const jobs = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  console.log(`[enrich] input: ${args.input} (${jobs.length} jobs)`);

  // Group by domain so we make 1 Hunter call per company, not per job.
  // Domain derivation is async (HEAD-checks); resolve serially to avoid
  // blasting target sites with parallel requests.
  console.log('[enrich] deriving domains (HEAD-check verified)...');
  const byDomain = new Map();
  for (const j of jobs) {
    const domain = await deriveDomain(j);
    j._derived_domain = domain;
    if (!domain) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(j);
  }
  const domains = [...byDomain.keys()];
  console.log(`[enrich] unique domains: ${domains.length}`);
  console.log(`[enrich] jobs without derivable domain: ${jobs.filter(j => !j._derived_domain).length}`);

  if (args.dryRun) {
    console.log('');
    console.log('DRY RUN — would call Hunter.io for these domains (1 call per domain, free tier = 25/mo):');
    for (const d of domains.slice(0, 30)) {
      const sample = byDomain.get(d)[0];
      console.log(`  ${d.padEnd(35)} <- ${sample.company} (${byDomain.get(d).length} job(s))`);
    }
    if (domains.length > 30) console.log(`  ... +${domains.length - 30} more`);
    console.log('');
    console.log(`Would consume ${Math.min(domains.length, args.max)} of 25 free Hunter calls/mo.`);
    console.log('Re-run with --confirm to execute. Or --max N to cap calls.');
    return;
  }

  // Real run
  const key = getKey();
  const target = domains.slice(0, args.max);
  console.log(`[enrich] CONFIRM mode: querying Hunter for ${target.length} domains`);

  const enriched = [];
  let calls = 0;
  for (const domain of target) {
    calls++;
    process.stdout.write(`  [${calls}/${target.length}] ${domain} ... `);
    const r = await hunterDomainSearch(domain, key);
    if (!r.ok) {
      console.log(`SKIP (${r.error.slice(0, 80)})`);
      for (const j of byDomain.get(domain)) {
        enriched.push({ ...j, contact: null, hunter_error: r.error });
      }
      continue;
    }
    const best = pickBestContact(r.data?.emails);
    if (!best) {
      console.log(`no founder/exec match (${(r.data?.emails || []).length} emails)`);
      for (const j of byDomain.get(domain)) {
        enriched.push({
          ...j, contact: null,
          hunter_summary: { total_emails: (r.data?.emails || []).length, pattern: r.data?.pattern, org: r.data?.organization },
        });
      }
      continue;
    }
    const contact = {
      name: [best.first_name, best.last_name].filter(Boolean).join(' ') || '(no name)',
      email: best.value,
      title: best.position,
      linkedin: best.linkedin || null,
      role_score: best.role_score,
      confidence: best.confidence,
    };
    console.log(`-> ${contact.name} (${contact.title}) <${contact.email}>`);
    for (const j of byDomain.get(domain)) {
      enriched.push({
        ...j, contact,
        hunter_summary: { total_emails: (r.data?.emails || []).length, pattern: r.data?.pattern, org: r.data?.organization },
      });
    }
  }

  // Anything we didn't query (because of --max cap) gets included with contact=null
  const queriedSet = new Set(target);
  for (const d of domains) {
    if (queriedSet.has(d)) continue;
    for (const j of byDomain.get(d)) {
      enriched.push({ ...j, contact: null, hunter_skipped: 'over --max cap' });
    }
  }

  // Sort: jobs with a contact first, by ICP score
  enriched.sort((a, b) => {
    const ac = a.contact ? 1 : 0; const bc = b.contact ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return (b.icp_score || 0) - (a.icp_score || 0);
  });

  fs.writeFileSync(args.output, JSON.stringify(enriched, null, 2));
  const withContacts = enriched.filter(e => e.contact);
  console.log('');
  console.log(`[enrich] wrote ${enriched.length} jobs to ${args.output}`);
  console.log(`[enrich] ${withContacts.length} have named contacts (${calls} Hunter calls used)`);
  console.log('');
  console.log('Top 10 enriched:');
  for (const e of withContacts.slice(0, 10)) {
    console.log(`  [icp ${String(e.icp_score).padStart(3)}] ${e.company} | ${e.title.slice(0, 40)}`);
    console.log(`    -> ${e.contact.name} (${e.contact.title}) <${e.contact.email}>`);
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
