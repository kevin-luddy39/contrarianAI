// GitHub collector for lead-intel.
//
// Pulls traffic (clones/views), stargazers, watchers, forks, issue authors,
// and enriches contacts with profile data. All public-repo reads; auth is
// optional but strongly recommended (unauth = 60 req/hr, authed = 5000/hr).
//
// Traffic endpoints require push access → the owner token must be used.

const USER_AGENT = 'contrarianai-lead-intel/0.1 (+https://contrarianai-landing.onrender.com)';

function headers() {
  const h = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GH_TOKEN) h.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  return h;
}

async function gh(url, { accept } = {}) {
  const h = headers();
  if (accept) h.Accept = accept;
  const res = await fetch(url, { headers: h });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitHub ${res.status} ${res.statusText} ${url} :: ${body.slice(0, 200)}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  return { json: await res.json(), remaining, reset, headers: res.headers };
}

async function ghPaginated(url, { max = 2000 } = {}) {
  const out = [];
  let next = url.includes('?') ? `${url}&per_page=100` : `${url}?per_page=100`;
  while (next && out.length < max) {
    const h = headers();
    const res = await fetch(next, { headers: h });
    if (!res.ok) {
      if (res.status === 403) {
        const reset = res.headers.get('x-ratelimit-reset');
        throw new Error(`GitHub rate limited (resets at ${reset}) on ${next}`);
      }
      throw new Error(`GitHub ${res.status} on ${next}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    out.push(...batch);
    const link = res.headers.get('link') || '';
    const m = link.split(',').map(s => s.trim()).find(s => s.endsWith('rel="next"'));
    next = m ? m.match(/<([^>]+)>/)?.[1] : null;
    if (batch.length < 100) break;
  }
  return out.slice(0, max);
}

// ---------- Traffic (owner-auth required) ----------
async function fetchTraffic(owner, repo) {
  if (!process.env.GH_TOKEN) {
    return { error: 'GH_TOKEN required for traffic endpoints', clones: null, views: null, referrers: null, paths: null };
  }
  try {
    const [clones, views, referrers, paths] = await Promise.all([
      gh(`https://api.github.com/repos/${owner}/${repo}/traffic/clones`).then(r => r.json),
      gh(`https://api.github.com/repos/${owner}/${repo}/traffic/views`).then(r => r.json),
      gh(`https://api.github.com/repos/${owner}/${repo}/traffic/popular/referrers`).then(r => r.json),
      gh(`https://api.github.com/repos/${owner}/${repo}/traffic/popular/paths`).then(r => r.json),
    ]);
    return { clones, views, referrers, paths };
  } catch (err) {
    return { error: err.message, clones: null, views: null, referrers: null, paths: null };
  }
}

// ---------- Named-audience collectors ----------
// Stargazers w/ starred_at timestamps (requires special Accept).
async function fetchStargazers(owner, repo, { max = 2000 } = {}) {
  const out = [];
  let page = 1;
  while (true) {
    const h = headers();
    h.Accept = 'application/vnd.github.star+json';
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`, { headers: h });
    if (!res.ok) throw new Error(`Stargazers ${res.status} on ${owner}/${repo}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const s of batch) {
      out.push({ starred_at: s.starred_at, user: s.user });
    }
    if (batch.length < 100 || out.length >= max) break;
    page++;
  }
  return out;
}

async function fetchWatchers(owner, repo) {
  return ghPaginated(`https://api.github.com/repos/${owner}/${repo}/subscribers`);
}

async function fetchForks(owner, repo) {
  return ghPaginated(`https://api.github.com/repos/${owner}/${repo}/forks`);
}

async function fetchIssueAuthors(owner, repo) {
  const issues = await ghPaginated(`https://api.github.com/repos/${owner}/${repo}/issues?state=all`, { max: 500 });
  return issues.filter(i => i.user);
}

// ---------- Profile enrichment ----------
async function fetchUserProfile(handle) {
  try {
    const r = await gh(`https://api.github.com/users/${handle}`);
    return r.json;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------- Repo metadata (stars/watchers counts) ----------
async function fetchRepoMeta(owner, repo) {
  const r = await gh(`https://api.github.com/repos/${owner}/${repo}`);
  return r.json;
}

// ---------- Rate-limit probe ----------
async function rateLimit() {
  try {
    const r = await gh('https://api.github.com/rate_limit');
    return r.json;
  } catch {
    return null;
  }
}

module.exports = {
  fetchTraffic,
  fetchStargazers,
  fetchWatchers,
  fetchForks,
  fetchIssueAuthors,
  fetchUserProfile,
  fetchRepoMeta,
  rateLimit,
};
