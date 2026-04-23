const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const UAParser = require('ua-parser-js');
const Stripe = require('stripe');
const { renderAdminPage } = require('./admin');
const leadIntel = require('./tools/lead-intel/collector');
const { suggestAction } = require('./tools/lead-intel/scoring');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
if (anthropic) console.log('Anthropic SDK enabled (model: claude-haiku-4-5 for intel-parse)');
else console.warn('ANTHROPIC_API_KEY not set — /api/admin/intel-parse will return 503');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://contrarianai-landing.onrender.com';

app.set('trust proxy', true);

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_requests (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT,
      ai_stack TEXT,
      pain TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE audit_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new'`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      audit_request_id INTEGER REFERENCES audit_requests(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      description TEXT,
      stripe_session_id TEXT UNIQUE,
      stripe_session_url TEXT,
      stripe_payment_intent_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      score INTEGER NOT NULL,
      band TEXT NOT NULL,
      answers JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      referrer TEXT,
      language TEXT,
      path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_state (
      id INTEGER PRIMARY KEY,
      last_report_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`INSERT INTO report_state (id) VALUES (1) ON CONFLICT DO NOTHING`);

  // ============================================================
  // Lead Intel schema
  // ============================================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      github_handle TEXT UNIQUE,
      email TEXT,
      name TEXT,
      company TEXT,
      website TEXT,
      twitter TEXT,
      linkedin_url TEXT,
      bio TEXT,
      location TEXT,
      avatar_url TEXT,
      followers_count INTEGER,
      public_repos INTEGER,
      tier TEXT,
      source TEXT,
      engagement_score NUMERIC DEFAULT 0,
      icp_fit NUMERIC DEFAULT 0,
      next_action TEXT,
      notes TEXT,
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      enriched_at TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS contacts_tier_idx ON contacts(tier)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS contacts_score_idx ON contacts(engagement_score DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS intel_events (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      repo TEXT,
      metadata JSONB,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS intel_events_contact_idx ON intel_events(contact_id, ts DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS intel_events_source_idx ON intel_events(source, event_type, ts DESC)`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS intel_events_dedup_idx
    ON intel_events(source, event_type, COALESCE(contact_id, 0), COALESCE(repo, ''), ts)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS intel_snapshots (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      metric TEXT NOT NULL,
      subject TEXT NOT NULL,
      day DATE NOT NULL,
      value NUMERIC NOT NULL,
      uniques NUMERIC,
      meta JSONB,
      collected_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS intel_snapshots_uniq
    ON intel_snapshots(source, metric, subject, day)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_posts (
      id SERIAL PRIMARY KEY,
      post_url TEXT UNIQUE NOT NULL,
      title TEXT,
      published_at TIMESTAMPTZ,
      impressions INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      reactions INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      reposts INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      sends INTEGER DEFAULT 0,
      link_clicks INTEGER DEFAULT 0,
      profile_views INTEGER DEFAULT 0,
      followers_gained INTEGER DEFAULT 0,
      demographics JSONB,
      notes TEXT,
      logged_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS intel_state (
      id INTEGER PRIMARY KEY,
      last_full_refresh_at TIMESTAMPTZ,
      last_piggyback_at TIMESTAMPTZ,
      last_github_traffic_at TIMESTAMPTZ,
      last_github_stars_at TIMESTAMPTZ,
      last_npm_at TIMESTAMPTZ,
      last_error TEXT
    )
  `);
  await pool.query(`INSERT INTO intel_state (id) VALUES (1) ON CONFLICT DO NOTHING`);

  // Tier-rank helper used by contacts upserts (must exist before any upsert).
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

// Email setup
let transporter = null;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'kevin.luddy39@gmail.com';
const STATS_EMAIL = process.env.STATS_EMAIL || 'luddy.kevin@gmail.com';

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log('Email notifications enabled');
} else {
  console.warn('SMTP_USER/SMTP_PASS not set — email notifications disabled');
}

// Stripe setup
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe enabled');
} else {
  console.warn('STRIPE_SECRET_KEY not set — payments disabled');
}

// ============================================================
// STRIPE WEBHOOK — must use raw body, mounted BEFORE express.json()
// ============================================================
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const result = await pool.query(
        `UPDATE payments
         SET status = 'paid', paid_at = NOW(), stripe_payment_intent_id = $1
         WHERE stripe_session_id = $2
         RETURNING audit_request_id, amount_cents`,
        [session.payment_intent, session.id]
      );

      if (result.rows.length > 0) {
        const { audit_request_id, amount_cents } = result.rows[0];
        await pool.query(`UPDATE audit_requests SET status = 'paid' WHERE id = $1`, [audit_request_id]);

        if (transporter) {
          const r = await pool.query('SELECT name, email, company FROM audit_requests WHERE id = $1', [audit_request_id]);
          const lead = r.rows[0];
          transporter.sendMail({
            from: `"contrarianAI" <${process.env.SMTP_USER}>`,
            to: NOTIFY_EMAIL,
            subject: `Payment received: $${(amount_cents / 100).toFixed(2)} from ${lead.name} at ${lead.company}`,
            text: [
              `Payment confirmed.`,
              ``,
              `Customer: ${lead.name} <${lead.email}>`,
              `Company:  ${lead.company}`,
              `Amount:   $${(amount_cents / 100).toFixed(2)}`,
              `Stripe PI: ${session.payment_intent}`,
              ``,
              `Next: schedule kickoff call.`,
            ].join('\n'),
          }).catch(err => console.error('Payment notify error:', err));
        }
      }
    } catch (err) {
      console.error('Payment update error:', err);
    }
  }

  res.json({ received: true });
});

// ============================================================
// Standard middleware
// ============================================================
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  // Trigger report check on every request (rate-limited to 30s internally).
  // Ensures the first request after a Render free-tier sleep fires a report.
  checkReport().catch(err => console.error('Wakeup check error:', err));
  next();
});

// Ping endpoint for external uptime monitors (UptimeRobot, cron-job.org, etc.)
// Hitting this keeps the service awake AND triggers the report check.
// Also fires a lightweight lead-intel refresh (cadence-gated, background).
app.get('/api/ping', (req, res) => {
  leadIntel.runLightRefresh(pool).catch(err => console.warn('[intel] piggyback error:', err.message));
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Token-gated cron endpoint for cron-job.org.
// Set CRON_SECRET in env; cron-job.org hits: /api/cron/intel-refresh?token=<CRON_SECRET>&mode=full|light
app.all('/api/cron/intel-refresh', async (req, res) => {
  const token = req.query.token || req.body?.token;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'bad token' });
  }
  const mode = (req.query.mode || 'full').toLowerCase();
  try {
    const result = mode === 'light'
      ? await leadIntel.runLightRefresh(pool)
      : await runIntelFull({ force: req.query.force === '1' });
    res.json({ ok: true, mode, result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Visit tracking
const EXCLUDED_IPS = new Set(
  (process.env.EXCLUDED_IPS || '98.24.147.4').split(',').map(s => s.trim()).filter(Boolean)
);

function isPageRequest(req) {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/api/')) return false;
  if (req.path.startsWith('/admin')) return false;
  const ext = path.extname(req.path);
  return !ext || ext === '.html';
}

app.use((req, res, next) => {
  if (isPageRequest(req)) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
    if (EXCLUDED_IPS.has(ip)) return next();
    const ua = req.headers['user-agent'] || '';
    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    const referrer = req.headers.referer || req.headers.referrer || '';
    const language = (req.headers['accept-language'] || '').split(',')[0] || '';

    pool.query(
      `INSERT INTO visits (ip, user_agent, browser, os, device, referrer, language, path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ip,
        ua,
        [browser.name, browser.version].filter(Boolean).join(' ') || null,
        [os.name, os.version].filter(Boolean).join(' ') || null,
        device.type || 'desktop',
        referrer || null,
        language || null,
        req.path,
      ]
    ).catch(err => console.error('Visit log error:', err));

    // Attempt to attribute GitHub-referred visits to a contact (fire-and-forget).
    leadIntel.linkVisitToContact(pool, {
      referrer, path: req.path, user_agent: ua,
    }).catch(() => {});
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clean URLs for the canonical Bell Tuning page — both /bell-tuning and
// /bell-tuning/ serve the manifesto directly without an extra 301 hop.
app.get(['/bell-tuning', '/bell-tuning/'], (req, res) => {
  res.sendFile(require('path').join(__dirname, 'landing', 'bell-tuning', 'index.html'));
});

app.use(express.static('landing'));

// ============================================================
// Form submission
// ============================================================
app.post('/api/audit-request', async (req, res) => {
  const { name, email, company, role, ai_stack, pain } = req.body;

  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Name, email, and company are required.' });
  }

  try {
    await pool.query(
      'INSERT INTO audit_requests (name, email, company, role, ai_stack, pain) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, email, company, role || null, ai_stack || null, pain || null]
    );
  } catch (err) {
    console.error('DB insert error:', err);
    return res.status(500).json({ error: 'Failed to save submission.' });
  }

  if (transporter) {
    transporter.sendMail({
      from: `"contrarianAI" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `New Diagnostic Request: ${name} at ${company}`,
      text: [
        'New diagnostic request submitted:',
        '',
        `Name:     ${name}`,
        `Email:    ${email}`,
        `Company:  ${company}`,
        `Role:     ${role || '(not provided)'}`,
        `AI Stack: ${ai_stack || '(not provided)'}`,
        `Pain:     ${pain || '(not provided)'}`,
      ].join('\n'),
    }).catch(err => console.error('Email send error:', err));
  }

  res.json({ success: true });
});

// ============================================================
// Self-assessment submission
// ============================================================
const QUESTION_TITLES = {
  observability: 'Observability',
  env_separation: 'Environment separation',
  secrets: 'Secrets management',
  rate_limiting: 'Rate limiting',
  unhappy_paths: 'Unhappy path testing',
  config_separation: 'Config separation',
  error_surfacing: 'Error surfacing',
  cost_controls: 'Cost controls',
  external_eval: 'External evaluation',
  session_continuity: 'Session continuity',
  compaction: 'Compaction resilience',
  escalation: 'Escalation logic',
};

function buildAssessmentEmail(name, score, band, answers) {
  const lines = [
    `Hi ${name},`,
    ``,
    `Here are your AI Production Readiness Self-Assessment results:`,
    ``,
    `Score: ${score} / 24`,
    `Band:  ${band}`,
    ``,
    `Breakdown:`,
    ...Object.entries(answers).map(([key, val]) => {
      const title = QUESTION_TITLES[key] || key;
      return `  ${title.padEnd(28)} ${val} / 2`;
    }),
    ``,
    `What this means:`,
    ``,
  ];

  if (score >= 20) {
    lines.push(
      `You're in the top ~5% of teams running AI in production. The full diagnostic will still find 3+ issues — we always do — but they'll be subtler: tool description routing, context rot patterns, semantic layer gaps. Worth doing if you're scaling past $50K/month in AI spend.`
    );
  } else if (score >= 14) {
    lines.push(
      `You have the basics right but are exposed in 3-5 specific areas. A targeted diagnostic will recover 5-10x its cost in the first quarter, usually through cost optimization or reducing silent failure rates. This is our most common client profile.`
    );
  } else if (score >= 8) {
    lines.push(
      `You're running what most vendors would call a "working AI product," but it's structurally brittle. You almost certainly have active incidents you can't diagnose, high spend you can't explain, and users losing trust for reasons you can't pinpoint. The diagnostic will find 10+ fixable issues.`
    );
  } else {
    lines.push(
      `Stop. Before you add features, fix the foundation. If you're generating revenue on this stack, you're running on borrowed time. The diagnostic becomes a mandatory step before your next release — not a nice-to-have.`
    );
  }

  lines.push(
    ``,
    `Lowest-scoring items (where I'd start):`,
    ...Object.entries(answers)
      .filter(([, val]) => val <= 1)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([key, val]) => `  - ${QUESTION_TITLES[key] || key} (${val}/2)`),
    ``,
    `If you want the full diagnostic — with prioritized fixes, a written report, and the personal guarantee that I find 3+ production-impacting issues or you don't pay:`,
    ``,
    `  https://contrarianai-landing.onrender.com/#audit-form`,
    ``,
    `— Kevin`,
    `contrarianAI`
  );

  return lines.join('\n');
}

app.post('/api/assessment', async (req, res) => {
  const { name, email, company, score, band, answers } = req.body;

  if (!name || !email || !company || typeof score !== 'number' || !band || !answers) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    await pool.query(
      'INSERT INTO assessments (name, email, company, score, band, answers) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, email, company, score, band, JSON.stringify(answers)]
    );
  } catch (err) {
    console.error('Assessment insert error:', err);
    return res.status(500).json({ error: 'Failed to save assessment.' });
  }

  if (transporter) {
    // Send results to the user
    transporter.sendMail({
      from: `"contrarianAI" <${process.env.SMTP_USER}>`,
      to: email,
      bcc: NOTIFY_EMAIL,
      subject: `Your AI Production Readiness Score: ${score}/24 — ${band}`,
      text: buildAssessmentEmail(name, score, band, answers),
    }).catch(err => console.error('Assessment email error:', err));

    // Lead notification (separate so subject is distinct)
    transporter.sendMail({
      from: `"contrarianAI" <${process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `New Assessment Lead: ${name} at ${company} — ${score}/24`,
      text: [
        `Self-assessment completed:`,
        ``,
        `Name:    ${name}`,
        `Email:   ${email}`,
        `Company: ${company}`,
        `Score:   ${score} / 24`,
        `Band:    ${band}`,
        ``,
        `Answers:`,
        ...Object.entries(answers).map(([k, v]) => `  ${(QUESTION_TITLES[k] || k).padEnd(28)} ${v}/2`),
      ].join('\n'),
    }).catch(err => console.error('Assessment notify error:', err));
  }

  res.json({ success: true });
});

// ============================================================
// Admin (basic auth)
// ============================================================
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return res.status(503).send('Admin not configured. Set ADMIN_USER and ADMIN_PASS env vars.');
  }
  const auth = req.headers.authorization || '';
  const [type, encoded] = auth.split(' ');
  if (type === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="contrarianAI Admin"');
  return res.status(401).send('Authentication required');
}

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const requestsResult = await pool.query(`
      SELECT
        r.id, r.name, r.email, r.company, r.role, r.ai_stack, r.pain, r.status, r.created_at,
        p.id as payment_id,
        p.amount_cents,
        p.status as payment_status,
        p.stripe_session_url,
        p.created_at as payment_created_at,
        p.paid_at
      FROM audit_requests r
      LEFT JOIN LATERAL (
        SELECT * FROM payments WHERE audit_request_id = r.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      ORDER BY r.created_at DESC
    `);

    const totalsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM audit_requests) as total_leads,
        (SELECT COUNT(*)::int FROM audit_requests WHERE status = 'new') as new_leads,
        (SELECT COUNT(*)::int FROM audit_requests WHERE status = 'payment_sent') as payment_sent,
        (SELECT COUNT(*)::int FROM audit_requests WHERE status = 'paid') as paid_leads,
        (SELECT COALESCE(SUM(amount_cents), 0)::int FROM payments WHERE status = 'paid') as total_revenue_cents
    `);
    const t = totalsResult.rows[0];

    res.send(renderAdminPage({
      requests: requestsResult.rows,
      totals: {
        totalLeads: t.total_leads,
        newLeads: t.new_leads,
        paymentSent: t.payment_sent,
        paidLeads: t.paid_leads,
        totalRevenueCents: t.total_revenue_cents,
      },
      stripeEnabled: !!stripe,
    }));
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).send('Internal server error');
  }
});

// ============================================================
// Admin JSON API (for remote dashboard)
// ============================================================
app.get('/api/admin/audit-requests', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.id as payment_id, p.amount_cents, p.status as payment_status,
             p.stripe_session_url, p.created_at as payment_created_at, p.paid_at
      FROM audit_requests r
      LEFT JOIN LATERAL (SELECT * FROM payments WHERE audit_request_id = r.id ORDER BY created_at DESC LIMIT 1) p ON true
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/assessments', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assessments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/visits', requireAdmin, async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT COUNT(*)::int as total, COUNT(DISTINCT ip)::int as unique_ips,
             MIN(created_at) as first_visit, MAX(created_at) as last_visit
      FROM visits
    `);
    const referrers = await pool.query(`
      SELECT COALESCE(NULLIF(referrer,''),'(direct)') as referrer, COUNT(*)::int as count
      FROM visits GROUP BY referrer ORDER BY count DESC LIMIT 10
    `);
    const browsers = await pool.query(`
      SELECT COALESCE(browser,'(unknown)') as browser, COUNT(*)::int as count
      FROM visits GROUP BY browser ORDER BY count DESC LIMIT 10
    `);
    const devices = await pool.query(`
      SELECT COALESCE(device,'desktop') as device, COUNT(*)::int as count
      FROM visits GROUP BY device ORDER BY count DESC
    `);
    const daily = await pool.query(`
      SELECT date_trunc('day', created_at)::date as day, COUNT(*)::int as count
      FROM visits GROUP BY day ORDER BY day DESC LIMIT 30
    `);
    res.json({
      summary: summary.rows[0],
      referrers: referrers.rows,
      browsers: browsers.rows,
      devices: devices.rows,
      daily: daily.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM audit_requests) as total_leads,
        (SELECT COUNT(*)::int FROM audit_requests WHERE status = 'new') as new_leads,
        (SELECT COUNT(*)::int FROM audit_requests WHERE status = 'paid') as paid_leads,
        (SELECT COALESCE(SUM(amount_cents),0)::int FROM payments WHERE status = 'paid') as total_revenue_cents,
        (SELECT COUNT(*)::int FROM visits) as total_visits,
        (SELECT COUNT(DISTINCT ip)::int FROM visits) as unique_visitors
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// Lead Intel — cross-site pipeline (GitHub, npm, LinkedIn, landing)
// ============================================================
let intelRefreshInFlight = false;
async function runIntelFull(opts = {}) {
  if (intelRefreshInFlight) return { skipped: 'in_flight' };
  intelRefreshInFlight = true;
  try {
    return await leadIntel.runFullRefresh(pool, opts);
  } finally {
    intelRefreshInFlight = false;
  }
}

app.post('/api/admin/intel-refresh', requireAdmin, async (req, res) => {
  try {
    const force = req.query.force === '1' || req.body?.force === true;
    const result = await runIntelFull({ force });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-overview', requireAdmin, async (req, res) => {
  try {
    const [state, counts, traffic, npm, funnel, topRefs, topPaths] = await Promise.all([
      pool.query(`SELECT * FROM intel_state WHERE id = 1`),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM contacts) as contacts,
          (SELECT COUNT(*)::int FROM contacts WHERE tier = 'star') as stars,
          (SELECT COUNT(*)::int FROM contacts WHERE tier = 'watcher') as watchers,
          (SELECT COUNT(*)::int FROM contacts WHERE tier = 'fork') as forks,
          (SELECT COUNT(*)::int FROM contacts WHERE tier IN ('issue_author','pr_author')) as issue_authors,
          (SELECT COUNT(*)::int FROM contacts WHERE email IS NOT NULL) as with_email,
          (SELECT COUNT(*)::int FROM intel_events WHERE ts > NOW() - INTERVAL '7 days') as events_7d,
          (SELECT COUNT(*)::int FROM intel_events WHERE ts > NOW() - INTERVAL '1 day') as events_1d
      `),
      pool.query(`
        SELECT subject as repo,
               SUM(CASE WHEN metric='clones' THEN value ELSE 0 END)::int as clones_total,
               SUM(CASE WHEN metric='clones' THEN uniques ELSE 0 END)::int as clones_uniques,
               SUM(CASE WHEN metric='views' THEN value ELSE 0 END)::int as views_total,
               SUM(CASE WHEN metric='views' THEN uniques ELSE 0 END)::int as views_uniques,
               MAX(day) as last_day
        FROM intel_snapshots
        WHERE source='github' AND metric IN ('clones','views') AND day > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY subject
        ORDER BY clones_total DESC
      `),
      pool.query(`
        SELECT subject as pkg,
               SUM(value)::int as downloads_30d,
               MAX(day) as last_day
        FROM intel_snapshots
        WHERE source='npm' AND metric='downloads' AND day > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY subject ORDER BY downloads_30d DESC
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM visits WHERE created_at > NOW() - INTERVAL '30 days') as visits_30d,
          (SELECT COUNT(DISTINCT ip)::int FROM visits WHERE created_at > NOW() - INTERVAL '30 days') as unique_30d,
          (SELECT COUNT(*)::int FROM assessments WHERE created_at > NOW() - INTERVAL '30 days') as assessments_30d,
          (SELECT COUNT(*)::int FROM audit_requests WHERE created_at > NOW() - INTERVAL '30 days') as leads_30d,
          (SELECT COUNT(*)::int FROM payments WHERE status='paid' AND paid_at > NOW() - INTERVAL '30 days') as paid_30d
      `),
      pool.query(`
        SELECT meta->>'referrer' as referrer, SUM(value)::int as count, subject as repo
        FROM intel_snapshots
        WHERE source='github' AND metric='referrer' AND day > CURRENT_DATE - INTERVAL '14 days'
        GROUP BY meta->>'referrer', subject
        ORDER BY count DESC LIMIT 20
      `),
      pool.query(`
        SELECT meta->>'path' as path, meta->>'title' as title, SUM(value)::int as count, subject as repo
        FROM intel_snapshots
        WHERE source='github' AND metric='path' AND day > CURRENT_DATE - INTERVAL '14 days'
        GROUP BY meta->>'path', meta->>'title', subject
        ORDER BY count DESC LIMIT 20
      `),
    ]);
    res.json({
      state: state.rows[0] || null,
      counts: counts.rows[0],
      traffic: traffic.rows,
      npm: npm.rows,
      funnel: funnel.rows[0],
      top_referrers: topRefs.rows,
      top_paths: topPaths.rows,
      refresh_in_flight: intelRefreshInFlight,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-contacts', requireAdmin, async (req, res) => {
  try {
    const tier = req.query.tier || null;
    const limit = Math.min(parseInt(req.query.limit || '500'), 2000);
    const order = req.query.order === 'recent' ? 'last_seen DESC' : 'engagement_score DESC, icp_fit DESC, last_seen DESC';
    const params = [];
    const where = [];
    if (tier) { params.push(tier); where.push(`tier = $${params.length}`); }
    if (req.query.has_email === '1') where.push(`email IS NOT NULL`);
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      const p = params.length;
      where.push(`(github_handle ILIKE $${p} OR name ILIKE $${p} OR company ILIKE $${p} OR bio ILIKE $${p})`);
    }
    params.push(limit);
    const limitParam = `$${params.length}`;
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT c.*,
              (SELECT jsonb_agg(jsonb_build_object('event_type', e.event_type, 'repo', e.repo, 'ts', e.ts) ORDER BY e.ts DESC)
               FROM intel_events e WHERE e.contact_id = c.id LIMIT 10) as recent_events
       FROM contacts c ${whereClause}
       ORDER BY ${order}
       LIMIT ${limitParam}`,
      params
    );
    const rows = result.rows.map(r => ({ ...r, suggested_action: suggestAction(r) }));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LLM-powered structured extraction for the manual contact form.
// Pastes raw text (LinkedIn About, DM thread, email, etc.) → extracted fields.
// Uses claude-haiku-4-5 with tool_use for strict JSON output.
app.post('/api/admin/intel-parse', requireAdmin, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }
  const raw = (req.body && typeof req.body.raw === 'string') ? req.body.raw : '';
  if (!raw.trim()) return res.status(400).json({ error: 'raw text required' });
  if (raw.length > 20000) return res.status(413).json({ error: 'paste too long (max 20k chars)' });

  const toolSchema = {
    name: 'save_contact',
    description: 'Extract structured contact information from unstructured text about a person.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Full name" },
        email: { type: 'string', description: 'Email address' },
        linkedin_url: { type: 'string', description: 'Full LinkedIn URL (https://www.linkedin.com/in/...)' },
        github_handle: { type: 'string', description: 'GitHub username only, no URL' },
        twitter: { type: 'string', description: 'Twitter/X handle, no @, no URL' },
        website: { type: 'string', description: 'Personal site URL' },
        company: { type: 'string', description: 'Current company or employer' },
        role: { type: 'string', description: 'Current job title / role' },
        location: { type: 'string', description: 'City / region / country' },
        bio: {
          type: 'string',
          description: 'Concise 1-3 sentence third-person summary emphasizing signal keywords useful for ICP scoring (seniority: staff/principal/senior/lead/director; AI relevance: ai/ml/llm/rag/agent/mlops; platform/infra/devtools; founder; government; legacy modernization). Do NOT copy the source verbatim — synthesize.',
        },
        seniority: {
          type: 'string',
          enum: ['junior','mid','senior','staff','principal','lead','manager','director','vp','cxo','founder'],
          description: 'Inferred seniority',
        },
        ai_relevance: {
          type: 'string',
          enum: ['ai_ml_core','ai_adjacent','ai_curious','non_ai'],
          description: "Proximity to AI/LLM work. ai_ml_core=builds AI systems; ai_adjacent=platform/infra/data eng likely to adopt; ai_curious=mentions/references AI; non_ai=no AI signal.",
        },
        tier: {
          type: 'string',
          enum: ['visit','star','watcher','issue_author','fork','pr_author','audit_request','customer'],
          description: "Engagement tier inferred from any conversational context. Default 'visit' if unclear.",
        },
        icp_notes: { type: 'string', description: "One line on whether this contact fits contrarianAI ICP (senior engineer/leader at a company running AI agents or RAG in production) and why." },
        next_action_suggestion: { type: 'string', description: 'Concrete suggested next outreach step based on what was extracted.' },
        raw_context_summary: { type: 'string', description: 'One-sentence description of what the pasted content was (e.g. "LinkedIn About + Top Skills section", "Slack DM reply thread", "email signature").' },
      },
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'save_contact' },
      messages: [{
        role: 'user',
        content:
`You extract structured contact fields for a lead-intel dashboard. The user runs contrarianAI — an AI audit / "Bell Tuning" consulting practice targeting teams running LLM agents, RAG, or long-context workflows in production. ICP = senior engineers / tech leads / managers / founders at 10-500 person companies who have AI in production or are clearly about to.

Favor high recall on explicit identifiers (email, URLs, handles).
Favor high precision on inferred fields (seniority, ai_relevance, tier).
If a field is not supported by the text, omit it — do not hallucinate.
For 'bio', write a NEW concise 1-3 sentence third-person summary tuned for ICP keyword scoring; do not copy the source verbatim.

CONTENT:
${raw}`,
      }],
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'save_contact');
    if (!toolBlock) return res.status(502).json({ error: 'model did not emit tool_use' });

    res.json({
      ok: true,
      extracted: toolBlock.input,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
      },
      model: response.model,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('[intel-parse] Anthropic error:', err.status, err.message);
      return res.status(err.status || 500).json({ error: err.message });
    }
    console.error('[intel-parse] error:', err);
    res.status(500).json({ error: err.message || 'extraction failed' });
  }
});

// Manual contact creation for non-GitHub sources (LinkedIn DMs, email threads,
// conference/conversation leads). All fields optional except needs at least one
// identifier (name / github_handle / email / linkedin_url).
app.post('/api/admin/intel-contact', requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.name && !p.github_handle && !p.email && !p.linkedin_url) {
      return res.status(400).json({ error: 'at least one of name/github_handle/email/linkedin_url required' });
    }
    const r = await pool.query(
      `INSERT INTO contacts
        (github_handle, email, name, company, linkedin_url, twitter, website, bio, location,
         tier, source, notes, next_action)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        p.github_handle || null, p.email || null, p.name || null, p.company || null,
        p.linkedin_url || null, p.twitter || null, p.website || null,
        p.bio || null, p.location || null,
        p.tier || 'visit', p.source || 'manual', p.notes || null, p.next_action || null,
      ]
    );
    const id = r.rows[0].id;
    await pool.query(
      `INSERT INTO intel_events (contact_id, source, event_type, metadata)
       VALUES ($1, 'manual', $2, $3)`,
      [id, p.event_type || 'manual_add',
       JSON.stringify({ reason: p.reason || 'manual', via: p.via || null })]
    );
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-contact/:id', requireAdmin, async (req, res) => {
  try {
    const c = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [req.params.id]);
    if (!c.rows[0]) return res.status(404).json({ error: 'not found' });
    const e = await pool.query(
      `SELECT * FROM intel_events WHERE contact_id = $1 ORDER BY ts DESC LIMIT 200`,
      [req.params.id]
    );
    res.json({ contact: { ...c.rows[0], suggested_action: suggestAction(c.rows[0]) }, events: e.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/intel-contact/:id', requireAdmin, async (req, res) => {
  try {
    const { notes, next_action } = req.body || {};
    const sets = [];
    const params = [];
    if (notes !== undefined) { params.push(notes); sets.push(`notes = $${params.length}`); }
    if (next_action !== undefined) { params.push(next_action); sets.push(`next_action = $${params.length}`); }
    if (sets.length === 0) return res.json({ ok: true });
    params.push(req.params.id);
    await pool.query(`UPDATE contacts SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// DM Composer — pulls warm-pool leads and renders paste-ready DMs for the
// $2,500 Bell Tuning Rapid Audit offer. Read-only (GET) + event-log (POST).
// ============================================================

const RAPID_AUDIT_STRIPE = 'https://buy.stripe.com/00w28sfq5gjS6Dg4Ia9IQ00';

function renderPool1DM(lead) {
  const pain = (lead.pain || '').trim();
  const painExcerpt = pain.length > 280 ? pain.slice(0, 280) + '...' : pain;
  const paraphrase = painExcerpt
    || (lead.ai_stack ? `your ${lead.ai_stack} setup` : 'your AI setup');
  const submitted = new Date(lead.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstName = lead.name ? String(lead.name).split(/\s+/)[0] : 'there';
  const trackingLink = `${RAPID_AUDIT_STRIPE}?ref=dm-audit-lead-${lead.id}`;
  return [
    `Subject: Quick offer for the audit you asked about`,
    ``,
    `Hi ${firstName},`,
    ``,
    `You filled out the contrarianAI audit form back in ${submitted} asking about:`,
    ``,
    `  "${paraphrase}"`,
    ``,
    `We never closed the loop on that - that's on me.`,
    ``,
    `I'm productizing the audit work into a faster, cheaper SKU: the Bell Tuning Rapid Audit. $2,500 flat, 48-hour turnaround. Five sensors run against your retrieval / agent pipeline, 8-12 page PDF with flagged pathologies and prioritized fixes, 30-min walkthrough call, 7 days of Q&A after.`,
    ``,
    `Limited to 3 audits per week. Two slots open this week.`,
    ``,
    `If your original ask is still unresolved, this is the fastest path to a defensible answer. Pay link (no negotiation):`,
    ``,
    trackingLink,
    ``,
    `Or reply with current stack details and I'll confirm fit before you pay.`,
    ``,
    `Kevin`,
  ].join('\n');
}

function renderPool2DM(contact) {
  const firstName = contact.name ? String(contact.name).split(/\s+/)[0]
    : (contact.github_handle ? '@' + contact.github_handle : 'there');
  const trackingTag = contact.github_handle ? contact.github_handle : ('contact-' + contact.id);
  const trackingLink = `${RAPID_AUDIT_STRIPE}?ref=dm-${contact.tier || 'leadintel'}-${trackingTag}`;
  const signal = contact.tier === 'pr_author' ? 'opened a PR against contrarianAI'
    : contact.tier === 'issue_author' ? 'opened an issue on contrarianAI'
    : contact.tier === 'fork' ? 'forked contrarianAI'
    : contact.tier === 'watcher' ? 'watched contrarianAI'
    : 'starred contrarianAI/context-inspector';
  return [
    `Hi ${firstName},`,
    ``,
    `Saw you ${signal}. Curious whether you ended up using it in a real pipeline, or just bookmarked.`,
    ``,
    `Either way - I'm doing 3 Bell Tuning Rapid Audits this week. $2,500 fixed, 48hr turnaround, 5 sensors run against your retrieval pipeline, full PDF report, walkthrough call. If you're shipping RAG or agents in production and want a defensible read on retrieval-distribution health + flagged pathologies + prioritized fixes, this is the fastest version of the audit work I do.`,
    ``,
    `Pay link: ${trackingLink}`,
    `Spec: https://contrarianai-landing.onrender.com/bell-tuning-rapid-audit.html`,
    ``,
    `No pitch beyond this - either it's useful or it's not.`,
    ``,
    `Kevin`,
  ].join('\n');
}

app.get('/api/admin/dm-composer', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // Pool 1 — unconverted audit_requests
    const pool1Res = await pool.query(`
      SELECT
        ar.id, ar.name, ar.email, ar.company, ar.role, ar.pain, ar.ai_stack, ar.created_at,
        COALESCE(
          (SELECT status FROM payments p
           WHERE p.audit_request_id = ar.id
           ORDER BY created_at DESC LIMIT 1),
          'no_payment_sent'
        ) AS payment_status,
        EXISTS(
          SELECT 1 FROM intel_events e
          WHERE e.source = 'dm-composer'
            AND e.event_type = 'dm_sent_pool1'
            AND (e.metadata->>'audit_request_id')::int = ar.id
        ) AS dm_sent
      FROM audit_requests ar
      WHERE ar.created_at > NOW() - INTERVAL '12 months'
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.audit_request_id = ar.id
            AND p.status IN ('paid', 'succeeded', 'complete')
        )
      ORDER BY ar.created_at DESC
      LIMIT $1
    `, [limit]);

    // Pool 2 — tier:star+ Lead Intel contacts
    const pool2Res = await pool.query(`
      SELECT
        c.id, c.github_handle, c.name, c.email, c.company, c.bio, c.tier,
        c.engagement_score, c.icp_fit, c.twitter, c.linkedin_url, c.first_seen,
        EXISTS(
          SELECT 1 FROM intel_events e
          WHERE e.contact_id = c.id
            AND e.source = 'dm-composer'
            AND e.event_type = 'dm_sent_pool2'
        ) AS dm_sent
      FROM contacts c
      WHERE c.tier IN ('star','watcher','fork','issue_author','pr_author','audit_request')
        AND c.first_seen > NOW() - INTERVAL '12 months'
      ORDER BY
        CASE c.tier
          WHEN 'pr_author' THEN 1 WHEN 'issue_author' THEN 2
          WHEN 'fork' THEN 3 WHEN 'watcher' THEN 4
          WHEN 'star' THEN 5 ELSE 9
        END,
        c.icp_fit DESC NULLS LAST,
        c.engagement_score DESC
      LIMIT $1
    `, [limit]);

    const pool1 = pool1Res.rows.map(lead => ({
      ...lead,
      dm_text: renderPool1DM(lead),
      tracking_ref: `dm-audit-lead-${lead.id}`,
    }));

    const pool2 = pool2Res.rows.map(c => ({
      ...c,
      dm_text: renderPool2DM(c),
      tracking_ref: `dm-${c.tier || 'leadintel'}-${c.github_handle || 'contact-' + c.id}`,
    }));

    res.json({
      stripe_link: RAPID_AUDIT_STRIPE,
      pool1: { label: 'Pool 1 — unconverted audit_requests (warmest)', items: pool1 },
      pool2: { label: 'Pool 2 — tier:star+ Lead Intel (code-engaged)', items: pool2 },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/mark-dm-sent', requireAdmin, async (req, res) => {
  try {
    const { pool: poolName, audit_request_id, contact_id, channel, notes } = req.body || {};
    if (poolName === 'pool1' && audit_request_id) {
      await pool.query(
        `INSERT INTO intel_events (source, event_type, metadata)
         VALUES ('dm-composer', 'dm_sent_pool1', $1)`,
        [JSON.stringify({ audit_request_id, channel: channel || 'manual', notes: notes || null })]
      );
      return res.json({ ok: true });
    }
    if (poolName === 'pool2' && contact_id) {
      await pool.query(
        `INSERT INTO intel_events (contact_id, source, event_type, metadata)
         VALUES ($1, 'dm-composer', 'dm_sent_pool2', $2)`,
        [contact_id, JSON.stringify({ channel: channel || 'manual', notes: notes || null })]
      );
      await pool.query(
        `UPDATE contacts SET next_action = $1 WHERE id = $2`,
        [`Rapid Audit DM sent ${new Date().toISOString().slice(0,10)}; follow up +5 days`, contact_id]
      );
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'Missing pool + audit_request_id/contact_id' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-snapshots', requireAdmin, async (req, res) => {
  try {
    const source = req.query.source || null;
    const metric = req.query.metric || null;
    const subject = req.query.subject || null;
    const days = Math.min(parseInt(req.query.days || '30'), 365);
    const params = [];
    const where = [`day > CURRENT_DATE - ($${params.push(days + ' days')}::interval)`];
    if (source) { params.push(source); where.push(`source = $${params.length}`); }
    if (metric) { params.push(metric); where.push(`metric = $${params.length}`); }
    if (subject) { params.push(subject); where.push(`subject = $${params.length}`); }
    const result = await pool.query(
      `SELECT source, metric, subject, day, value, uniques, meta
       FROM intel_snapshots
       WHERE ${where.join(' AND ')}
       ORDER BY day DESC, source, metric, subject`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-linkedin', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM linkedin_posts ORDER BY published_at DESC NULLS LAST`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/intel-linkedin', requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.post_url) return res.status(400).json({ error: 'post_url required' });
    const result = await pool.query(
      `INSERT INTO linkedin_posts
        (post_url, title, published_at, impressions, reach, reactions, comments, reposts, saves, sends, link_clicks, profile_views, followers_gained, demographics, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (post_url) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, linkedin_posts.title),
         published_at = COALESCE(EXCLUDED.published_at, linkedin_posts.published_at),
         impressions = GREATEST(EXCLUDED.impressions, linkedin_posts.impressions),
         reach = GREATEST(EXCLUDED.reach, linkedin_posts.reach),
         reactions = GREATEST(EXCLUDED.reactions, linkedin_posts.reactions),
         comments = GREATEST(EXCLUDED.comments, linkedin_posts.comments),
         reposts = GREATEST(EXCLUDED.reposts, linkedin_posts.reposts),
         saves = GREATEST(EXCLUDED.saves, linkedin_posts.saves),
         sends = GREATEST(EXCLUDED.sends, linkedin_posts.sends),
         link_clicks = GREATEST(EXCLUDED.link_clicks, linkedin_posts.link_clicks),
         profile_views = GREATEST(EXCLUDED.profile_views, linkedin_posts.profile_views),
         followers_gained = GREATEST(EXCLUDED.followers_gained, linkedin_posts.followers_gained),
         demographics = COALESCE(EXCLUDED.demographics, linkedin_posts.demographics),
         notes = COALESCE(EXCLUDED.notes, linkedin_posts.notes),
         updated_at = NOW()
       RETURNING id`,
      [
        p.post_url, p.title || null, p.published_at || null,
        p.impressions || 0, p.reach || 0, p.reactions || 0, p.comments || 0,
        p.reposts || 0, p.saves || 0, p.sends || 0, p.link_clicks || 0,
        p.profile_views || 0, p.followers_gained || 0,
        p.demographics ? JSON.stringify(p.demographics) : null,
        p.notes || null,
      ]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/intel-action-queue', requireAdmin, async (req, res) => {
  try {
    // Hot: high score, no next_action recorded
    const hot = await pool.query(`
      SELECT * FROM contacts
      WHERE engagement_score >= 20 AND COALESCE(next_action,'') = ''
      ORDER BY engagement_score DESC, icp_fit DESC LIMIT 25
    `);
    const icp = await pool.query(`
      SELECT * FROM contacts
      WHERE tier = 'star' AND icp_fit >= 10 AND COALESCE(next_action,'') = ''
      ORDER BY icp_fit DESC, engagement_score DESC LIMIT 25
    `);
    const withEmail = await pool.query(`
      SELECT * FROM contacts
      WHERE email IS NOT NULL AND tier = 'star' AND COALESCE(next_action,'') = ''
      ORDER BY engagement_score DESC LIMIT 25
    `);
    const fresh = await pool.query(`
      SELECT * FROM contacts
      WHERE first_seen > NOW() - INTERVAL '7 days'
      ORDER BY first_seen DESC LIMIT 25
    `);
    const tag = rows => rows.map(r => ({ ...r, suggested_action: suggestAction(r) }));
    res.json({ hot: tag(hot.rows), icp_stars: tag(icp.rows), with_email: tag(withEmail.rows), recently_added: tag(fresh.rows) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/lead-intel', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'landing', 'lead-intel.html'));
});

app.post('/admin/payment', requireAdmin, async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe not configured');

  const { audit_request_id, amount_usd, description } = req.body;
  const amountCents = Math.round(parseFloat(amount_usd) * 100);

  if (!audit_request_id || isNaN(amountCents) || amountCents < 100) {
    return res.status(400).send('Invalid request: amount must be at least $1.00');
  }

  try {
    const reqResult = await pool.query('SELECT email, name FROM audit_requests WHERE id = $1', [audit_request_id]);
    if (reqResult.rows.length === 0) return res.status(404).send('Request not found');
    const customer = reqResult.rows[0];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customer.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: description || 'AI Production Diagnostic',
            description: 'contrarianAI engagement',
          },
        },
        quantity: 1,
      }],
      success_url: `${PUBLIC_URL}/payment-success.html`,
      cancel_url: `${PUBLIC_URL}/`,
      metadata: { audit_request_id: String(audit_request_id) },
    });

    await pool.query(
      `INSERT INTO payments (audit_request_id, amount_cents, description, stripe_session_id, stripe_session_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [audit_request_id, amountCents, description || 'AI Production Diagnostic', session.id, session.url]
    );

    await pool.query(`UPDATE audit_requests SET status = 'payment_sent' WHERE id = $1`, [audit_request_id]);

    res.redirect('/admin');
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).send('Failed to create payment session: ' + err.message);
  }
});

// ============================================================
// Visit reporting
// ============================================================
let reportInFlight = false;

async function buildVisitReport(since) {
  const totals = await pool.query(
    `SELECT COUNT(*)::int as total, COUNT(DISTINCT ip)::int as unique_visitors,
            MIN(created_at) as first_visit, MAX(created_at) as last_visit
     FROM visits WHERE created_at > $1`,
    [since]
  );
  const t = totals.rows[0];

  const topReferrers = await pool.query(
    `SELECT COALESCE(NULLIF(referrer, ''), '(direct)') as ref, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY ref ORDER BY c DESC LIMIT 5`,
    [since]
  );

  const topBrowsers = await pool.query(
    `SELECT COALESCE(browser, '(unknown)') as b, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY b ORDER BY c DESC LIMIT 5`,
    [since]
  );

  const topOS = await pool.query(
    `SELECT COALESCE(os, '(unknown)') as o, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY o ORDER BY c DESC LIMIT 5`,
    [since]
  );

  const topDevices = await pool.query(
    `SELECT COALESCE(device, 'desktop') as d, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY d ORDER BY c DESC`,
    [since]
  );

  const topLanguages = await pool.query(
    `SELECT COALESCE(language, '(unknown)') as l, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY l ORDER BY c DESC LIMIT 5`,
    [since]
  );

  const topIps = await pool.query(
    `SELECT ip, COUNT(*)::int as c
     FROM visits WHERE created_at > $1 AND ip <> ''
     GROUP BY ip ORDER BY c DESC LIMIT 5`,
    [since]
  );

  const hourly = await pool.query(
    `SELECT date_trunc('hour', created_at) as hr, COUNT(*)::int as c
     FROM visits WHERE created_at > $1
     GROUP BY hr ORDER BY hr`,
    [since]
  );

  const formatRows = (rows, keyCol) =>
    rows.length === 0
      ? '  (none)'
      : rows.map(r => `  ${String(r[keyCol]).slice(0, 60).padEnd(60)} ${r.c}`).join('\n');

  return [
    `contrarianAI — Visit Report`,
    `===========================`,
    ``,
    `Window:          ${new Date(since).toISOString()}  ->  ${new Date().toISOString()}`,
    `Total visits:    ${t.total}`,
    `Unique visitors: ${t.unique_visitors}`,
    `First visit:     ${t.first_visit ? new Date(t.first_visit).toISOString() : '-'}`,
    `Last visit:      ${t.last_visit ? new Date(t.last_visit).toISOString() : '-'}`,
    ``,
    `Top Referrers`,
    `-------------`,
    formatRows(topReferrers.rows, 'ref'),
    ``,
    `Top Browsers`,
    `------------`,
    formatRows(topBrowsers.rows, 'b'),
    ``,
    `Top OS`,
    `------`,
    formatRows(topOS.rows, 'o'),
    ``,
    `Devices`,
    `-------`,
    formatRows(topDevices.rows, 'd'),
    ``,
    `Top Languages`,
    `-------------`,
    formatRows(topLanguages.rows, 'l'),
    ``,
    `Top IPs`,
    `-------`,
    formatRows(topIps.rows, 'ip'),
    ``,
    `Hourly Distribution`,
    `-------------------`,
    hourly.rows.length === 0
      ? '  (none)'
      : hourly.rows.map(r => `  ${new Date(r.hr).toISOString().slice(0, 13)}:00  ${'#'.repeat(Math.min(r.c, 40))} ${r.c}`).join('\n'),
    ``,
  ].join('\n');
}

async function sendVisitReport(reason) {
  const stateResult = await pool.query('SELECT last_report_at FROM report_state WHERE id = 1');
  const since = stateResult.rows[0].last_report_at;

  const countResult = await pool.query(
    'SELECT COUNT(*)::int as c FROM visits WHERE created_at > $1',
    [since]
  );
  const count = countResult.rows[0].c;

  const body = count === 0
    ? [
        `contrarianAI — Visit Report (Heartbeat)`,
        `=======================================`,
        ``,
        `Window: ${new Date(since).toISOString()}  ->  ${new Date().toISOString()}`,
        `Total visits: 0`,
        ``,
        `No traffic in this window. Service is alive and reporting.`,
      ].join('\n')
    : await buildVisitReport(since);

  const subject = count === 0
    ? `[contrarianAI] Heartbeat — 0 visits`
    : `[contrarianAI] ${count} visit${count === 1 ? '' : 's'} — ${reason}`;

  if (transporter) {
    await transporter.sendMail({
      from: `"contrarianAI Stats" <${process.env.SMTP_USER}>`,
      to: STATS_EMAIL,
      subject,
      text: body,
    });
    console.log(`Visit report sent (${count} visits, ${reason})`);
  } else {
    console.log(`Would send visit report (${count} visits, ${reason}) but SMTP not configured`);
  }

  await pool.query('UPDATE report_state SET last_report_at = NOW() WHERE id = 1');
}

// Rate-limit checkReport to avoid hammering the DB on every incoming request
let lastCheckAt = 0;
const CHECK_DEBOUNCE_MS = 30 * 1000;
const HEARTBEAT_HOURS = 6;

async function checkReport() {
  if (reportInFlight) return;
  const now = Date.now();
  if (now - lastCheckAt < CHECK_DEBOUNCE_MS) return;
  lastCheckAt = now;

  try {
    const stateResult = await pool.query('SELECT last_report_at FROM report_state WHERE id = 1');
    const lastReport = stateResult.rows[0].last_report_at;

    const countResult = await pool.query(
      'SELECT COUNT(*)::int as c FROM visits WHERE created_at > $1',
      [lastReport]
    );
    const count = countResult.rows[0].c;
    const hoursSince = (Date.now() - new Date(lastReport).getTime()) / 3600000;

    // Send if: 10+ visits (threshold) OR 6+ hours elapsed (heartbeat, even with 0 visits)
    const shouldSend = count >= 10 || hoursSince >= HEARTBEAT_HOURS;

    if (shouldSend) {
      reportInFlight = true;
      try {
        const reason = count >= 10 ? 'threshold' : 'heartbeat';
        await sendVisitReport(reason);
      } finally {
        reportInFlight = false;
      }
    }
  } catch (err) {
    console.error('Report check error:', err);
    reportInFlight = false;
  }
}

// Run the timer while the service is awake
setInterval(checkReport, 60 * 1000);

// Start server after DB is ready
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
