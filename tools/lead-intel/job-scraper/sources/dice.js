// Dice search-page scraper. Dice's React app embeds the search results in
// a Next.js __NEXT_DATA__ script tag we can extract without rendering JS.
// Public results, no auth. Less hostile than Indeed/Glassdoor but stricter
// than RemoteOK - browser-flavored UA required.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const SEARCHES = [
  'AI Engineer',
  'AI Workflow',
  'RAG Engineer',
  'LLM Engineer',
  'Agent Engineer',
];

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function pluckJobs(nextData) {
  // Dice nests the search results under different keys depending on the
  // page version. Walk the tree looking for arrays of items shaped like jobs.
  const out = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    // Heuristic: a job has a title, a company, a URL or jobId
    if (node.jobTitle && node.companyName) {
      out.push({
        id: node.jobId || node.id || node.url || node.jobTitle,
        title: node.jobTitle,
        company: node.companyName,
        url: node.url || (node.jobId ? `https://www.dice.com/job-detail/${node.jobId}` : null),
        description: node.summary || node.description || '',
        tags: node.skills || [],
        posted_at: node.postedDate || node.dateAdded || null,
        location: node.location || node.jobLocation || '',
        salary: node.salary || null,
      });
    }
    for (const k of Object.keys(node)) walk(node[k]);
  }
  walk(nextData);
  return out;
}

async function fetchJobs() {
  const all = [];
  const seen = new Set();
  for (const q of SEARCHES) {
    const url = `https://www.dice.com/jobs?q=${encodeURIComponent(q)}&location=United%20States`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const html = await res.text();
      const nd = extractNextData(html);
      if (!nd) continue;
      const jobs = pluckJobs(nd);
      for (const j of jobs) {
        const key = `${j.company}|${j.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          source: 'dice',
          id: `dice:${j.id}`,
          ...j,
        });
      }
    } catch (e) { /* skip failed search */ }
  }
  return all;
}

module.exports = { fetchJobs };
