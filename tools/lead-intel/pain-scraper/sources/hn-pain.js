// HN pain-content scraper. Searches Algolia for pain phrases across
// HN comments and Show/Ask HN posts. Returns matches with author handle.

const UA = 'contrarianai-pain-scout/0.1';

// Phrases worth searching directly via Algolia (string-match, not regex)
const HN_QUERIES = [
  '"can\'t figure out why" rag',
  '"can\'t figure out why" agent',
  '"silently failing" llm',
  '"hallucinating in production"',
  '"eval passes" but',
  '"rank inversion" rag',
  '"my rag" failing',
  '"my agent" stuck',
  'agent stuck loop production',
  '"output feels off" llm',
  '"customers complain" llm rag',
  'production rag debugging hours',
];

async function fetchHnQuery(q, sinceDays = 14) {
  const since = Math.floor((Date.now() - sinceDays * 86400 * 1000) / 1000);
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&numericFilters=created_at_i%3E${since}&hitsPerPage=20`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.hits || [];
  } catch { return []; }
}

async function fetchPosts(opts = {}) {
  const { sinceDays = 14 } = opts;
  const seen = new Set();
  const all = [];
  for (const q of HN_QUERIES) {
    const hits = await fetchHnQuery(q, sinceDays);
    for (const h of hits) {
      if (!h.objectID || seen.has(h.objectID)) continue;
      seen.add(h.objectID);
      const text = h.comment_text || h.story_text || h.title || '';
      all.push({
        source: 'hn',
        id: h.objectID,
        author: h.author,
        title: h.title || (h.story_title || ''),
        text,
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        ups: h.points,
        num_comments: h.num_comments,
        created_at: h.created_at,
        story_id: h.story_id,
      });
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return all;
}

module.exports = { fetchPosts, HN_QUERIES };
