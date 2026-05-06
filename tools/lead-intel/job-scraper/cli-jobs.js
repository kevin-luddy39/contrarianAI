#!/usr/bin/env node
// Application-intent CLI. Same scrape pipeline as cli.js but:
//   - Filters via application-icp.js (Kevin's skills) not outreach-icp
//   - Filters via geo-filter.js (remote OR 2hr of 28429)
//   - Excludes via dedup-ledger.js (stealth mode: no companies in active
//     contrarianAI outreach window, default 14 days)
//   - Writes per-job tailoring memos for Kevin to review before applying
//
// Usage:
//   node tools/lead-intel/job-scraper/cli-jobs.js --since 7d
//   node tools/lead-intel/job-scraper/cli-jobs.js --min-score 14 --max 20
//   node tools/lead-intel/job-scraper/cli-jobs.js --dedup-window 14
//   node tools/lead-intel/job-scraper/cli-jobs.js --no-stealth   # ignore outreach ledger

const fs = require('fs');
const path = require('path');

const { scoreJobForApplication } = require('./application-icp');
const { dedupe } = require('./dedupe');
const { classify: geoClassify } = require('./geo-filter');
const { loadOutreachLedger, isCompanyInActiveOutreach } = require('./dedup-ledger');
const { parseSalary, passesFloor } = require('./salary-parse');

const SOURCES = {
  remoteok: require('./sources/remoteok'),
  wwr: require('./sources/wwr'),
  hn: require('./sources/hn'),
  dice: require('./sources/dice'),
};

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

function parseArgs(argv) {
  const out = {
    output: null, minScore: 12, since: null, sources: Object.keys(SOURCES),
    max: 30, dedupWindow: 14, stealth: true, usOnly: false,
    minSalary: 110000,  // USD floor per Kevin 2026-05-06
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output' || a === '-o') out.output = argv[++i];
    else if (a === '--min-score') out.minScore = parseInt(argv[++i], 10);
    else if (a === '--since') {
      const m = argv[++i].match(/^(\d+)([dh])$/);
      if (m) {
        const n = parseInt(m[1], 10);
        const ms = m[2] === 'd' ? n * 86400 * 1000 : n * 3600 * 1000;
        out.since = new Date(Date.now() - ms);
      }
    }
    else if (a === '--sources') out.sources = argv[++i].split(',').map(s => s.trim());
    else if (a === '--max') out.max = parseInt(argv[++i], 10);
    else if (a === '--dedup-window') out.dedupWindow = parseInt(argv[++i], 10);
    else if (a === '--no-stealth') out.stealth = false;
    else if (a === '--us-only') out.usOnly = true;
    else if (a === '--min-salary') out.minSalary = parseInt(argv[++i], 10);
    else if (a === '--no-salary-filter') out.minSalary = 0;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node cli-jobs.js [--since 7d] [--min-score 12] [--max 30] [--dedup-window 14] [--no-stealth] [--us-only] [--min-salary 110000] [--no-salary-filter]');
      process.exit(0);
    }
  }
  if (!out.output) {
    const today = new Date().toISOString().slice(0, 10);
    out.output = path.join(__dirname, 'output', `applications-${today}.json`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });

  console.log(`[apps] sources: ${args.sources.join(', ')} | min-score: ${args.minScore}`);
  console.log(`[apps] geo: remote OR 2hr of Castle Hayne NC 28429${args.usOnly ? ' | US-ONLY mode (rejecting EU/UK/LATAM/Asia/etc)' : ''}`);
  console.log(`[apps] stealth: ${args.stealth ? `ON (excluding companies in last ${args.dedupWindow}d outreach)` : 'OFF'}`);
  console.log(`[apps] output: ${args.output}`);

  // Pull from sources
  const results = await Promise.allSettled(args.sources.map(async (s) => {
    const mod = SOURCES[s];
    if (!mod) return { source: s, ok: false, err: 'unknown source' };
    try {
      const jobs = await mod.fetchJobs();
      console.log(`  [${s}] fetched ${jobs.length} raw`);
      return { source: s, ok: true, jobs };
    } catch (e) {
      console.log(`  [${s}] FAILED: ${e.message}`);
      return { source: s, ok: false, err: e.message };
    }
  }));

  const allJobs = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) allJobs.push(...r.value.jobs);
  }
  console.log(`[apps] total raw: ${allJobs.length}`);

  // Date filter
  let filtered = allJobs;
  if (args.since) {
    filtered = filtered.filter(j => {
      if (!j.posted_at) return true;
      try { return new Date(j.posted_at) >= args.since; } catch { return true; }
    });
    console.log(`[apps] after date filter (${args.since.toISOString().slice(0, 10)}+): ${filtered.length}`);
  }

  // Geo filter
  const beforeGeo = filtered.length;
  filtered = filtered.map(j => ({ ...j, _geo: geoClassify(j, { usOnly: args.usOnly }) })).filter(j => j._geo.ok);
  console.log(`[apps] after geo filter${args.usOnly ? ' (US-only)' : ''}: ${filtered.length} (dropped ${beforeGeo - filtered.length})`);

  // Salary filter
  if (args.minSalary > 0) {
    const beforeSal = filtered.length;
    let droppedDisclosed = 0;
    filtered = filtered.map(j => {
      const sal = parseSalary([j.title, j.description, JSON.stringify(j.tags || '')].join(' '));
      const pass = passesFloor(sal, args.minSalary);
      return { ...j, _salary: sal, _salary_check: pass };
    }).filter(j => {
      if (j._salary_check.ok) return true;
      droppedDisclosed++;
      return false;
    });
    console.log(`[apps] after salary floor ($${(args.minSalary/1000).toFixed(0)}k USD min): ${filtered.length} (dropped ${droppedDisclosed} disclosed-below-floor; undisclosed kept with flag)`);
  }

  // ICP score (application-flavored)
  const scored = filtered.map(j => {
    const s = scoreJobForApplication(j);
    return { ...j, app_score: s.score, app_tags: s.tags, app_anti: s.anti, app_reason: s.reason || null };
  });
  const passed = scored.filter(j => !j.app_anti && j.app_score >= args.minScore);
  console.log(`[apps] after app-ICP filter (score >= ${args.minScore}): ${passed.length}`);

  // Dedupe across sources
  const deduped = dedupe(passed);
  console.log(`[apps] after cross-source dedup: ${deduped.length}`);

  // Stealth: exclude companies in active outreach
  let final = deduped;
  let excluded = [];
  if (args.stealth) {
    const ledger = loadOutreachLedger(args.dedupWindow);
    final = [];
    for (const j of deduped) {
      const blocker = isCompanyInActiveOutreach(j.company, ledger);
      if (blocker) {
        excluded.push({ company: j.company, blocker });
      } else {
        final.push(j);
      }
    }
    console.log(`[apps] stealth excluded ${excluded.length} (in active outreach window):`);
    for (const e of excluded) {
      console.log(`  - ${e.company}  (touched ${e.blocker.last_touchpoint_ts.slice(0, 10)} via ${e.blocker.tier})`);
    }
  }

  final.sort((a, b) => (b.app_score || 0) - (a.app_score || 0));
  const limited = final.slice(0, args.max);

  fs.writeFileSync(args.output, JSON.stringify(limited, null, 2));
  console.log('');
  console.log(`[apps] wrote ${limited.length} application candidates to ${args.output}`);
  console.log('');
  console.log('Top 15 by application-ICP score:');
  for (const j of limited.slice(0, 15)) {
    const tags = (j.app_tags || []).slice(0, 5).join(',');
    const geo = j._geo?.reason || '?';
    console.log(`  ${String(j.app_score).padStart(3)}  [${j.source.padEnd(8)}] [${geo.padEnd(10)}] ${j.company} | ${j.title.slice(0, 50)} | ${tags}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
