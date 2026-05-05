#!/usr/bin/env node
// Job-scraper CLI - Phase 1.
// Pulls jobs from RemoteOK, WeWorkRemotely, HN Who-is-Hiring, Dice.
// Filters by ICP score + dedupes by (company, title). Writes JSON output.
//
// Usage:
//   node tools/lead-intel/job-scraper/cli.js
//   node tools/lead-intel/job-scraper/cli.js --output /tmp/jobs.json --min-score 12
//   node tools/lead-intel/job-scraper/cli.js --since 7d   # only jobs posted in last N days

const fs = require('fs');
const path = require('path');

const { scoreJob, passesIcpThreshold } = require('./icp');
const { dedupe } = require('./dedupe');

const SOURCES = {
  remoteok: require('./sources/remoteok'),
  wwr: require('./sources/wwr'),
  hn: require('./sources/hn'),
  dice: require('./sources/dice'),
};

function parseArgs(argv) {
  const out = { output: null, minScore: 10, since: null, sources: Object.keys(SOURCES) };
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
    } else if (a === '--sources') {
      out.sources = argv[++i].split(',').map(s => s.trim());
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node cli.js [--output PATH] [--min-score N] [--since 7d] [--sources hn,remoteok]`);
      process.exit(0);
    }
  }
  if (!out.output) {
    const today = new Date().toISOString().slice(0, 10);
    out.output = path.join(__dirname, 'output', `jobs-${today}.json`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });

  console.log(`[scraper] sources: ${args.sources.join(', ')} | min-score: ${args.minScore} | since: ${args.since || 'all'}`);
  console.log(`[scraper] output: ${args.output}`);

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
  console.log(`[scraper] total raw across sources: ${allJobs.length}`);

  // Date filter
  let filtered = allJobs;
  if (args.since) {
    filtered = filtered.filter(j => {
      if (!j.posted_at) return true;  // unknown dates: keep
      try { return new Date(j.posted_at) >= args.since; } catch { return true; }
    });
    console.log(`[scraper] after date filter (${args.since.toISOString().slice(0, 10)}+): ${filtered.length}`);
  }

  // ICP score
  const scored = filtered.map(j => {
    const s = scoreJob(j);
    return { ...j, icp_score: s.score, icp_tags: s.tags, is_senior: s.is_senior, anti_flagged: s.anti };
  });
  // Inline threshold check - passesIcpThreshold expects scoreJob's raw output
  // shape (score+anti), but we've spread it onto the job under different
  // field names. Inline avoids the indirection.
  const passed = scored.filter(j => !j.anti_flagged && (j.icp_score || 0) >= args.minScore);
  console.log(`[scraper] after ICP filter (score >= ${args.minScore}): ${passed.length}`);

  // Dedupe
  const deduped = dedupe(passed);
  console.log(`[scraper] after dedupe: ${deduped.length}`);

  // Sort by score desc
  deduped.sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0));

  fs.writeFileSync(args.output, JSON.stringify(deduped, null, 2));
  console.log(`[scraper] wrote ${deduped.length} jobs to ${args.output}`);
  console.log('');
  console.log('Top 10 by ICP score:');
  for (const j of deduped.slice(0, 10)) {
    const tags = (j.icp_tags || []).slice(0, 5).join(',');
    console.log(`  ${String(j.icp_score).padStart(3)}  [${j.source.padEnd(8)}] ${j.company} | ${j.title.slice(0, 50)} | ${tags}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
