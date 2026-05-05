// HN Who-is-Hiring fetcher. Pulls the current month's thread + extracts
// per-comment job postings. Algolia HN API (public, no auth).

const UA = 'contrarianai-job-scout/0.1';

async function findCurrentThread() {
  // Find the most recent "Ask HN: Who is hiring?" story
  const url = 'https://hn.algolia.com/api/v1/search?query=who+is+hiring&tags=story,author_whoishiring&hitsPerPage=3';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`hn search: HTTP ${res.status}`);
  const d = await res.json();
  // Pick the freshest one
  const hit = (d.hits || [])[0];
  if (!hit) throw new Error('hn search: no whoishiring thread found');
  return hit.objectID;
}

function decodeHtml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJobLine(text) {
  // HN job posts conventionally start: "Company | Role | Location | REMOTE/ONSITE | URL"
  // Take first line / first sentence as the header
  const firstChunk = text.split(/[.\n]/)[0].slice(0, 300);
  // First "|" separated cell = company
  const parts = firstChunk.split('|').map(s => s.trim()).filter(Boolean);
  return {
    company: parts[0] || '(unknown)',
    title: parts[1] || firstChunk.slice(0, 80),
    location: parts.find(p => /\b(remote|onsite|hybrid|usa|us|eu|uk|sf|nyc|berlin|london)\b/i.test(p)) || '',
  };
}

async function fetchJobs() {
  const threadId = await findCurrentThread();
  const url = `https://hn.algolia.com/api/v1/items/${threadId}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`hn thread: HTTP ${res.status}`);
  const d = await res.json();

  const jobs = [];
  for (const c of (d.children || [])) {
    const text = decodeHtml(c.text || '');
    if (!text) continue;
    const parsed = parseJobLine(text);
    jobs.push({
      source: 'hn',
      id: `hn:${c.objectID || c.id}`,
      company: parsed.company,
      title: parsed.title,
      url: `https://news.ycombinator.com/item?id=${c.objectID || c.id}`,
      description: text.slice(0, 1500),
      tags: [],
      posted_at: c.created_at,
      location: parsed.location,
      hn_author: c.author,
    });
  }
  return jobs;
}

module.exports = { fetchJobs };
