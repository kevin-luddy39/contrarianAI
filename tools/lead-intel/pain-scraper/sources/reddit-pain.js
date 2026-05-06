// Reddit pain-content scraper. Reads /new from a list of subs, applies
// pain-phrase scoring on title + selftext + top-N comments.

const UA = 'contrarianai-pain-scout/0.1';

const SUBS = [
  'Rag', 'LangChain', 'AI_Agents', 'LLMDevs', 'MachineLearning',
  'mlops', 'OpenAI', 'LocalLLaMA', 'learnmachinelearning', 'ChatGPTPro',
  'datascience', 'ExperiencedDevs',
];

async function fetchSub(sub, limit = 50) {
  const url = `https://www.reddit.com/r/${sub}/new.json?limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.children || []).map(c => c.data);
  } catch { return []; }
}

async function fetchComments(permalink, limit = 10) {
  // permalink format: /r/Sub/comments/<id>/<slug>/
  const url = `https://www.reddit.com${permalink}.json?limit=${limit}&depth=2`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const json = await res.json();
    const cl = (json[1]?.data?.children || []).map(c => c.data).filter(c => c?.body);
    return cl;
  } catch { return []; }
}

async function fetchPosts(opts = {}) {
  const { sinceDays = 14, perSub = 50, includeComments = false } = opts;
  const cutoff = Date.now() / 1000 - sinceDays * 86400;
  const all = [];
  for (const sub of SUBS) {
    const posts = await fetchSub(sub, perSub);
    for (const p of posts) {
      if (!p?.created_utc || p.created_utc < cutoff) continue;
      const item = {
        source: 'reddit',
        sub,
        id: p.id,
        author: p.author,
        title: p.title,
        text: p.selftext || '',
        url: `https://reddit.com${p.permalink}`,
        permalink: p.permalink,
        ups: p.ups,
        num_comments: p.num_comments,
        created_at: new Date(p.created_utc * 1000).toISOString(),
      };
      if (includeComments && p.permalink) {
        const cmts = await fetchComments(p.permalink, 8);
        item.comments = cmts.map(c => ({ author: c.author, body: c.body, ups: c.ups }));
      }
      all.push(item);
    }
    // Rate-limit courtesy
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

module.exports = { fetchPosts, SUBS };
