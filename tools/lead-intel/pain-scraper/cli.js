#!/usr/bin/env node
// Pain-content scraper CLI. Pulls public pain posts/comments/issues from
// Reddit, HN, GitHub. Scores via pain-phrases.js. Outputs ranked prospects.
//
// Usage:
//   node tools/lead-intel/pain-scraper/cli.js
//   node tools/lead-intel/pain-scraper/cli.js --since 7d --min-pain 12
//   node tools/lead-intel/pain-scraper/cli.js --sources hn,github  # skip reddit

const fs = require('fs');
const path = require('path');

const { scorePainText } = require('./pain-phrases');

const SOURCES = {
  reddit: require('./sources/reddit-pain'),
  hn: require('./sources/hn-pain'),
  github: require('./sources/github-issues'),
};

function parseArgs(argv) {
  const out = { sinceDays: 14, minPain: 10, sources: Object.keys(SOURCES), output: null, max: 50 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--since') {
      const m = argv[++i].match(/^(\d+)d$/);
      if (m) out.sinceDays = parseInt(m[1], 10);
    } else if (a === '--min-pain') out.minPain = parseInt(argv[++i], 10);
    else if (a === '--sources') out.sources = argv[++i].split(',').map(s => s.trim());
    else if (a === '--output' || a === '-o') out.output = argv[++i];
    else if (a === '--max') out.max = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node cli.js [--since 14d] [--min-pain 10] [--sources reddit,hn,github] [--max 50]');
      process.exit(0);
    }
  }
  if (!out.output) {
    const today = new Date().toISOString().slice(0, 10);
    out.output = path.join(__dirname, 'output', `pain-${today}.json`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });

  console.log(`[pain] sources: ${args.sources.join(', ')} | since: ${args.sinceDays}d | min-pain: ${args.minPain}`);
  console.log(`[pain] output: ${args.output}`);

  const allPosts = [];
  for (const s of args.sources) {
    const mod = SOURCES[s];
    if (!mod) continue;
    try {
      const posts = await mod.fetchPosts({ sinceDays: args.sinceDays });
      console.log(`  [${s}] fetched ${posts.length} raw`);
      allPosts.push(...posts);
    } catch (e) {
      console.log(`  [${s}] ERROR: ${e.message}`);
    }
  }
  console.log(`[pain] total raw across sources: ${allPosts.length}`);

  // Score each
  const scored = allPosts.map(p => {
    const haystack = `${p.title || ''} ${p.text || ''}`;
    const s = scorePainText(haystack);
    return { ...p, pain_score: s.score, pain_tags: s.tags, pain_anti: s.anti };
  });
  const passed = scored.filter(p => p.pain_score >= args.minPain);
  console.log(`[pain] after pain filter (score >= ${args.minPain}): ${passed.length}`);

  // Sort by pain score, take top N
  passed.sort((a, b) => (b.pain_score || 0) - (a.pain_score || 0));
  const top = passed.slice(0, args.max);

  fs.writeFileSync(args.output, JSON.stringify(top, null, 2));
  console.log(`[pain] wrote ${top.length} prospects to ${args.output}`);
  console.log('');
  console.log('Top 15 by pain score:');
  for (const p of top.slice(0, 15)) {
    const tags = (p.pain_tags || []).slice(0, 3).join(',');
    const title = (p.title || p.text || '').slice(0, 70).replace(/\s+/g, ' ');
    console.log(`  ${String(p.pain_score).padStart(3)} [${p.source.padEnd(7)}] @${(p.author || '?').padEnd(20)} ${tags.padEnd(40)} ${title}`);
    console.log(`        ${p.url}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
