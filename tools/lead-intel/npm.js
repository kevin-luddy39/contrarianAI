// npm registry collector.
//
// Pulls daily download counts and basic pkg metadata for our published tools.
// Uses the public api.npmjs.org downloads API — no auth required.

const USER_AGENT = 'contrarianai-lead-intel/0.1';

async function jget(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`npm ${res.status} ${url} :: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// Daily downloads for the last `days` full days (excluding today, per npm).
// Returns [{ day: 'YYYY-MM-DD', downloads: int }].
async function fetchDailyDownloads(pkg, days = 30) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  const url = `https://api.npmjs.org/downloads/range/${s}:${e}/${encodeURIComponent(pkg)}`;
  const json = await jget(url);
  return (json.downloads || []).map(d => ({ day: d.day, downloads: d.downloads }));
}

async function fetchLastDay(pkg) {
  const json = await jget(`https://api.npmjs.org/downloads/point/last-day/${encodeURIComponent(pkg)}`);
  return json.downloads || 0;
}

async function fetchPkgMeta(pkg) {
  try {
    const json = await jget(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
    const latest = json['dist-tags']?.latest;
    return {
      name: json.name,
      latest_version: latest,
      last_published: latest ? json.time?.[latest] : null,
      maintainers: (json.maintainers || []).map(m => m.name),
      description: json.description,
    };
  } catch (err) {
    return { name: pkg, error: err.message };
  }
}

module.exports = {
  fetchDailyDownloads,
  fetchLastDay,
  fetchPkgMeta,
};
