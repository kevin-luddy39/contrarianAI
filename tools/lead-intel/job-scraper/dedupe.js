// Dedupe jobs across sources by (normalized company, normalized title).
// If the same company+title appears in multiple sources, keep the one with
// the most data (longest description, more tags, newer posted_at).

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(inc|corp|corporation|llc|ltd|gmbh|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestOf(a, b) {
  // Heuristic: prefer the one with more description text + more tags
  const aw = (a.description || '').length + (a.tags || []).length * 50;
  const bw = (b.description || '').length + (b.tags || []).length * 50;
  return aw >= bw ? a : b;
}

function dedupe(jobs) {
  const map = new Map();
  for (const j of jobs) {
    const key = `${normalize(j.company)}|${normalize(j.title)}`;
    if (!map.has(key)) {
      map.set(key, j);
    } else {
      const cur = map.get(key);
      const winner = bestOf(cur, j);
      // Track all sources the job was seen in
      winner.also_seen_in = winner.also_seen_in || [];
      const loser = winner === cur ? j : cur;
      if (!winner.also_seen_in.includes(loser.source)) {
        winner.also_seen_in.push(loser.source);
      }
      map.set(key, winner);
    }
  }
  return Array.from(map.values());
}

module.exports = { dedupe, normalize };
