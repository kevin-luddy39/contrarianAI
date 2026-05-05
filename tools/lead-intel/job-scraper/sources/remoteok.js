// RemoteOK fetcher. Public JSON API at https://remoteok.com/api.
// Returns full feed of remote jobs (~100). We filter ICP downstream.

const UA = 'contrarianai-job-scout/0.1 (+https://contrarianai-landing.onrender.com)';

async function fetchJobs() {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`remoteok: HTTP ${res.status}`);
  const raw = await res.json();
  // First entry is metadata - skip
  const jobs = raw.slice(1);
  return jobs.map(j => ({
    source: 'remoteok',
    id: `remoteok:${j.id || j.slug}`,
    company: j.company || '(unknown)',
    title: j.position || j.title || '',
    url: j.url || j.apply_url || `https://remoteok.com/remote-jobs/${j.slug}`,
    description: j.description || '',
    tags: Array.isArray(j.tags) ? j.tags : [],
    posted_at: j.date || (j.epoch ? new Date(j.epoch * 1000).toISOString() : null),
    location: j.location || 'Remote',
    salary_min: j.salary_min,
    salary_max: j.salary_max,
  }));
}

module.exports = { fetchJobs };
