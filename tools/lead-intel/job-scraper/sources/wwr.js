// WeWorkRemotely RSS fetcher. RSS feed for programming category.
// Public, no auth. Limited fields vs JSON sources but reliable.

const UA = 'contrarianai-job-scout/0.1';

const FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
];

function parseRss(xml) {
  const items = [];
  const itemMatches = xml.split('<item>').slice(1);
  for (const item of itemMatches) {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
      return m ? m[1].trim() : '';
    };
    const title = get('title');
    const link = get('link');
    const desc = get('description');
    const pubDate = get('pubDate');
    if (!title) continue;

    // WWR title format: "Company: Job Title"
    const colonIdx = title.indexOf(':');
    const company = colonIdx > 0 ? title.slice(0, colonIdx).trim() : '(unknown)';
    const position = colonIdx > 0 ? title.slice(colonIdx + 1).trim() : title;

    items.push({
      source: 'wwr',
      id: `wwr:${link.replace(/[^a-z0-9]/gi, '').slice(-30)}`,
      company,
      title: position,
      url: link,
      description: desc.replace(/<[^>]+>/g, ' ').slice(0, 800),
      tags: [],
      posted_at: pubDate ? new Date(pubDate).toISOString() : null,
      location: 'Remote',
    });
  }
  return items;
}

async function fetchJobs() {
  const all = [];
  for (const url of FEEDS) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const xml = await res.text();
      all.push(...parseRss(xml));
    } catch (e) { /* skip failed feed */ }
  }
  return all;
}

module.exports = { fetchJobs };
