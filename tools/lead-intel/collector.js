// Orchestrator — runs GitHub + npm collectors and writes into Postgres.
//
// Exports:
//   runFullRefresh(pool)   — everything, respects cadence unless { force: true }
//   runLightRefresh(pool)  — stars + traffic only (cheap, piggyback-safe)
//   runLinkedInVisit(pool, visit) — fold a landing visit into intel_events
//
// All collectors are idempotent — safe to re-run. Snapshots upsert on
// (source, metric, subject, day). Stargazers dedupe on github_handle.

const gh = require('./github');
const npmc = require('./npm');
const { scoreIcp } = require('./scoring');
const {
  ensureTierRankFn, upsertContact, logEvent, upsertSnapshot,
  recomputeScores, setState, getState,
} = require('./store');
const { REPOS, NPM_PACKAGES, CADENCES } = require('./config');

function secsSince(ts) {
  if (!ts) return Infinity;
  return (Date.now() - new Date(ts).getTime()) / 1000;
}

function primaryRepos() { return REPOS.filter(r => r.primary); }

async function snapshotTraffic(pool, repo, traffic) {
  const subject = `${repo.owner}/${repo.repo}`;
  if (traffic.clones?.clones) {
    for (const c of traffic.clones.clones) {
      await upsertSnapshot(pool, {
        source: 'github', metric: 'clones', subject,
        day: c.timestamp.slice(0, 10),
        value: c.count, uniques: c.uniques,
      });
    }
  }
  if (traffic.views?.views) {
    for (const v of traffic.views.views) {
      await upsertSnapshot(pool, {
        source: 'github', metric: 'views', subject,
        day: v.timestamp.slice(0, 10),
        value: v.count, uniques: v.uniques,
      });
    }
  }
  if (Array.isArray(traffic.referrers)) {
    const today = new Date().toISOString().slice(0, 10);
    for (const r of traffic.referrers) {
      await upsertSnapshot(pool, {
        source: 'github', metric: 'referrer', subject: `${subject}::${r.referrer}`,
        day: today, value: r.count, uniques: r.uniques,
        meta: { referrer: r.referrer, repo: subject },
      });
    }
  }
  if (Array.isArray(traffic.paths)) {
    const today = new Date().toISOString().slice(0, 10);
    for (const p of traffic.paths) {
      await upsertSnapshot(pool, {
        source: 'github', metric: 'path', subject: `${subject}::${p.path}`,
        day: today, value: p.count, uniques: p.uniques,
        meta: { path: p.path, title: p.title, repo: subject },
      });
    }
  }
}

async function enrichAndUpsert(pool, user, tier, repoFullName, extra = {}) {
  if (!user?.login) return null;
  // Seed upsert with just the handle + tier.
  const id = await upsertContact(pool, {
    github_handle: user.login,
    avatar_url: user.avatar_url,
    tier,
    source: `github:${tier}`,
    ...extra,
  });
  await logEvent(pool, {
    contact_id: id, source: 'github', event_type: tier,
    repo: repoFullName, metadata: extra.starred_at ? { starred_at: extra.starred_at } : null,
    ts: extra.starred_at || null,
  });
  return id;
}

async function enrichProfiles(pool, { onlyStale = true, limit = 50 } = {}) {
  const cutoff = new Date(Date.now() - CADENCES.profiles * 1000).toISOString();
  const q = onlyStale
    ? `SELECT id, github_handle FROM contacts WHERE github_handle IS NOT NULL AND (enriched_at IS NULL OR enriched_at < $1) ORDER BY enriched_at NULLS FIRST, id ASC LIMIT $2`
    : `SELECT id, github_handle FROM contacts WHERE github_handle IS NOT NULL LIMIT $2`;
  const rows = await pool.query(q, onlyStale ? [cutoff, limit] : [limit]).then(r => r.rows);
  for (const row of rows) {
    try {
      const p = await gh.fetchUserProfile(row.github_handle);
      if (!p) continue;
      const icp = scoreIcp({
        bio: p.bio, company: p.company, name: p.name,
        location: p.location, followers_count: p.followers,
      });
      await pool.query(
        `UPDATE contacts SET name = COALESCE($2, name), company = COALESCE($3, company),
         website = COALESCE($4, website), twitter = COALESCE($5, twitter), bio = COALESCE($6, bio),
         location = COALESCE($7, location), email = COALESCE($8, email),
         followers_count = $9, public_repos = $10, icp_fit = $11, enriched_at = NOW()
         WHERE id = $1`,
        [row.id, p.name, p.company, p.blog || null, p.twitter_username || null, p.bio,
         p.location, p.email, p.followers ?? null, p.public_repos ?? null, icp.score]
      );
    } catch (err) {
      if (err.status === 404) {
        await pool.query(`UPDATE contacts SET enriched_at = NOW(), notes = COALESCE(notes,'') || ' [profile 404]' WHERE id = $1`, [row.id]);
      } else {
        console.warn(`[lead-intel] profile enrich ${row.github_handle} failed:`, err.message);
      }
    }
  }
  return rows.length;
}

async function collectStars(pool) {
  const report = {};
  for (const r of REPOS) {
    try {
      const stars = await gh.fetchStargazers(r.owner, r.repo);
      let added = 0;
      for (const s of stars) {
        if (!s.user) continue;
        const newRow = await enrichAndUpsert(pool, s.user, 'star', `${r.owner}/${r.repo}`, { starred_at: s.starred_at });
        if (newRow) added++;
      }
      report[`${r.owner}/${r.repo}`] = { stars: stars.length };
    } catch (err) {
      report[`${r.owner}/${r.repo}`] = { error: err.message };
    }
  }
  return report;
}

async function collectWatchersForksIssues(pool) {
  const report = {};
  for (const r of REPOS) {
    const full = `${r.owner}/${r.repo}`;
    report[full] = {};
    try {
      const watchers = await gh.fetchWatchers(r.owner, r.repo);
      for (const u of watchers) await enrichAndUpsert(pool, u, 'watcher', full);
      report[full].watchers = watchers.length;
    } catch (err) { report[full].watchers_error = err.message; }
    try {
      const forks = await gh.fetchForks(r.owner, r.repo);
      for (const f of forks) {
        if (f.owner) await enrichAndUpsert(pool, f.owner, 'fork', full, {});
      }
      report[full].forks = forks.length;
    } catch (err) { report[full].forks_error = err.message; }
    try {
      const issues = await gh.fetchIssueAuthors(r.owner, r.repo);
      for (const i of issues) {
        if (i.user) {
          const tier = i.pull_request ? 'pr_author' : 'issue_author';
          await enrichAndUpsert(pool, i.user, tier, full, {});
        }
      }
      report[full].issues = issues.length;
    } catch (err) { report[full].issues_error = err.message; }
  }
  return report;
}

async function collectTraffic(pool) {
  const report = {};
  for (const r of REPOS) {
    const full = `${r.owner}/${r.repo}`;
    try {
      const t = await gh.fetchTraffic(r.owner, r.repo);
      if (t.error) { report[full] = { error: t.error }; continue; }
      await snapshotTraffic(pool, r, t);
      report[full] = {
        clones_14d: t.clones?.count ?? 0,
        clones_uniques: t.clones?.uniques ?? 0,
        views_14d: t.views?.count ?? 0,
        views_uniques: t.views?.uniques ?? 0,
        referrers: (t.referrers || []).length,
        paths: (t.paths || []).length,
      };
    } catch (err) { report[full] = { error: err.message }; }
  }
  return report;
}

async function collectNpm(pool) {
  const report = {};
  for (const pkg of NPM_PACKAGES) {
    try {
      const days = await npmc.fetchDailyDownloads(pkg, 30);
      for (const d of days) {
        await upsertSnapshot(pool, {
          source: 'npm', metric: 'downloads', subject: pkg,
          day: d.day, value: d.downloads,
        });
      }
      const meta = await npmc.fetchPkgMeta(pkg);
      report[pkg] = {
        total_30d: days.reduce((a, b) => a + (b.downloads || 0), 0),
        latest: meta.latest_version,
        last_published: meta.last_published,
      };
    } catch (err) { report[pkg] = { error: err.message }; }
  }
  return report;
}

// Fold an existing landing-page visit into intel events, attributing to a
// contact if the referrer resolves to a github user URL. Called from the
// visit-tracking hook in server.js (best-effort, non-blocking).
async function linkVisitToContact(pool, visit) {
  if (!visit?.referrer) return;
  const m = visit.referrer.match(/github\.com\/([A-Za-z0-9-]+)(?:$|[/?#])/);
  if (!m) return;
  const handle = m[1];
  if (['orgs', 'features', 'pricing', 'login', 'signup'].includes(handle)) return;
  const id = await upsertContact(pool, {
    github_handle: handle, tier: 'visit', source: 'landing:github-ref',
  });
  await logEvent(pool, {
    contact_id: id, source: 'landing', event_type: 'landing_visit',
    metadata: { referrer: visit.referrer, path: visit.path, ua: visit.user_agent },
  });
}

// ---- High-level runners ----

async function runFullRefresh(pool, { force = false } = {}) {
  const state = await getState(pool);
  const results = { started: new Date().toISOString() };

  await ensureTierRankFn(pool);

  try {
    if (force || secsSince(state.last_github_stars_at) > CADENCES.stars) {
      results.stars = await collectStars(pool);
      await setState(pool, { last_github_stars_at: new Date() });
    }
    if (force || secsSince(state.last_github_traffic_at) > CADENCES.traffic) {
      results.traffic = await collectTraffic(pool);
      await setState(pool, { last_github_traffic_at: new Date() });
    }
    if (force || secsSince(state.last_github_stars_at) > CADENCES.watchers) {
      results.watchers_forks_issues = await collectWatchersForksIssues(pool);
    }
    if (force || secsSince(state.last_npm_at) > CADENCES.npm) {
      results.npm = await collectNpm(pool);
      await setState(pool, { last_npm_at: new Date() });
    }
    results.profiles_enriched = await enrichProfiles(pool, { onlyStale: true, limit: 80 });
    await recomputeScores(pool);
    await setState(pool, { last_full_refresh_at: new Date(), last_error: null });
  } catch (err) {
    results.error = err.message;
    await setState(pool, { last_error: err.message.slice(0, 500) });
    console.error('[lead-intel] full refresh error:', err);
  }

  results.finished = new Date().toISOString();
  return results;
}

async function runLightRefresh(pool) {
  const state = await getState(pool);
  if (secsSince(state.last_piggyback_at) < CADENCES.piggyback) {
    return { skipped: 'cadence', last_piggyback_at: state.last_piggyback_at };
  }
  const results = { started: new Date().toISOString() };
  try {
    await ensureTierRankFn(pool);
    // Only cheap work: stars on primary repos.
    for (const r of primaryRepos()) {
      const stars = await gh.fetchStargazers(r.owner, r.repo, { max: 500 });
      for (const s of stars) {
        if (!s.user) continue;
        await enrichAndUpsert(pool, s.user, 'star', `${r.owner}/${r.repo}`, { starred_at: s.starred_at });
      }
    }
    await recomputeScores(pool);
    await setState(pool, { last_piggyback_at: new Date() });
  } catch (err) {
    results.error = err.message;
    console.warn('[lead-intel] light refresh:', err.message);
  }
  results.finished = new Date().toISOString();
  return results;
}

module.exports = {
  runFullRefresh,
  runLightRefresh,
  enrichProfiles,
  linkVisitToContact,
  collectTraffic,
  collectStars,
  collectWatchersForksIssues,
  collectNpm,
};
