// Postgres persistence helpers for lead-intel.
// Takes a `pool` (pg.Pool) from the caller so we reuse the server's connection.

async function upsertContact(pool, data) {
  const {
    github_handle, email, name, company, website, twitter, linkedin_url,
    bio, location, avatar_url, followers_count, public_repos, tier, source,
  } = data;
  if (!github_handle) return null;
  const res = await pool.query(
    `
    INSERT INTO contacts (github_handle, email, name, company, website, twitter, linkedin_url, bio, location, avatar_url, followers_count, public_repos, tier, source, last_seen)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
    ON CONFLICT (github_handle) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, contacts.email),
      name = COALESCE(EXCLUDED.name, contacts.name),
      company = COALESCE(EXCLUDED.company, contacts.company),
      website = COALESCE(EXCLUDED.website, contacts.website),
      twitter = COALESCE(EXCLUDED.twitter, contacts.twitter),
      linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
      bio = COALESCE(EXCLUDED.bio, contacts.bio),
      location = COALESCE(EXCLUDED.location, contacts.location),
      avatar_url = COALESCE(EXCLUDED.avatar_url, contacts.avatar_url),
      followers_count = COALESCE(EXCLUDED.followers_count, contacts.followers_count),
      public_repos = COALESCE(EXCLUDED.public_repos, contacts.public_repos),
      tier = CASE
        WHEN contacts.tier IS NULL THEN EXCLUDED.tier
        WHEN EXCLUDED.tier IS NULL THEN contacts.tier
        WHEN tier_rank(EXCLUDED.tier) > tier_rank(contacts.tier) THEN EXCLUDED.tier
        ELSE contacts.tier
      END,
      source = COALESCE(EXCLUDED.source, contacts.source),
      last_seen = NOW()
    RETURNING id
    `,
    [
      github_handle, email || null, name || null, company || null, website || null,
      twitter || null, linkedin_url || null, bio || null, location || null,
      avatar_url || null, followers_count ?? null, public_repos ?? null,
      tier || null, source || null,
    ]
  );
  return res.rows[0]?.id;
}

// Promote to highest tier (ranked). Used when we don't have full profile yet.
async function ensureTierRankFn(pool) {
  await pool.query(`
    CREATE OR REPLACE FUNCTION tier_rank(t TEXT) RETURNS INT AS $$
      SELECT CASE COALESCE(t,'')
        WHEN 'payment' THEN 100
        WHEN 'customer' THEN 95
        WHEN 'audit_request' THEN 90
        WHEN 'pr_author' THEN 80
        WHEN 'issue_author' THEN 70
        WHEN 'fork' THEN 60
        WHEN 'watcher' THEN 50
        WHEN 'star' THEN 40
        WHEN 'assessment_submit' THEN 35
        WHEN 'assessment_start' THEN 25
        WHEN 'visit' THEN 10
        ELSE 0
      END
    $$ LANGUAGE SQL IMMUTABLE;
  `);
}

async function logEvent(pool, { contact_id, source, event_type, repo, metadata, ts }) {
  await pool.query(
    `INSERT INTO intel_events (contact_id, source, event_type, repo, metadata, ts)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()))
     ON CONFLICT DO NOTHING`,
    [contact_id || null, source, event_type, repo || null, metadata || null, ts || null]
  );
}

async function upsertSnapshot(pool, { source, metric, subject, day, value, uniques, meta }) {
  await pool.query(
    `INSERT INTO intel_snapshots (source, metric, subject, day, value, uniques, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (source, metric, subject, day) DO UPDATE SET
       value = EXCLUDED.value,
       uniques = EXCLUDED.uniques,
       meta = EXCLUDED.meta,
       collected_at = NOW()`,
    [source, metric, subject, day, value, uniques ?? null, meta || null]
  );
}

async function recomputeScores(pool) {
  await pool.query(`
    UPDATE contacts c SET engagement_score = sub.s
    FROM (
      SELECT contact_id,
             SUM(CASE event_type
               WHEN 'star' THEN 5
               WHEN 'watcher' THEN 8
               WHEN 'fork' THEN 12
               WHEN 'issue_author' THEN 18
               WHEN 'pr_author' THEN 25
               WHEN 'landing_visit' THEN 1
               WHEN 'assessment_start' THEN 10
               WHEN 'assessment_submit' THEN 25
               WHEN 'audit_request' THEN 60
               WHEN 'payment' THEN 200
               ELSE 0 END) AS s
      FROM intel_events WHERE contact_id IS NOT NULL GROUP BY contact_id
    ) sub
    WHERE c.id = sub.contact_id
  `);
}

async function setState(pool, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map(k => fields[k]);
  await pool.query(`UPDATE intel_state SET ${sets} WHERE id = 1`, values);
}

async function getState(pool) {
  const r = await pool.query(`SELECT * FROM intel_state WHERE id = 1`);
  return r.rows[0] || {};
}

module.exports = {
  ensureTierRankFn,
  upsertContact,
  logEvent,
  upsertSnapshot,
  recomputeScores,
  setState,
  getState,
};
