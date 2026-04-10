const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const UAParser = require('ua-parser-js');
const Stripe = require('stripe');
const { renderAdminPage } = require('./admin');

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
  next();
});

// Visit tracking
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
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
      subject: `New Audit Request: ${name} at ${company}`,
      text: [
        'New audit request submitted:',
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

app.post('/admin/payment', requireAdmin, async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe not configured');

  const { audit_request_id, amount_usd, description } = req.body;
  const amountCents = Math.round(parseFloat(amount_usd) * 100);

  if (!audit_request_id || isNaN(amountCents) || amountCents < 100) {
    return res.status(400).send('Invalid request: amount must be at least $1.00');
  }

  try {
    const reqResult = await pool.query('SELECT email, name FROM audit_requests WHERE id = $1', [audit_request_id]);
    if (reqResult.rows.length === 0) return res.status(404).send('Audit request not found');
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
            name: description || 'AI Risk & Readiness Audit',
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
      [audit_request_id, amountCents, description || 'AI Risk & Readiness Audit', session.id, session.url]
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

  if (count === 0) return;

  const body = await buildVisitReport(since);

  if (transporter) {
    await transporter.sendMail({
      from: `"contrarianAI Stats" <${process.env.SMTP_USER}>`,
      to: STATS_EMAIL,
      subject: `[contrarianAI] ${count} visits — ${reason}`,
      text: body,
    });
    console.log(`Visit report sent (${count} visits, ${reason})`);
  } else {
    console.log(`Would send visit report (${count} visits, ${reason}) but SMTP not configured`);
  }

  await pool.query('UPDATE report_state SET last_report_at = NOW() WHERE id = 1');
}

async function checkReport() {
  if (reportInFlight) return;
  try {
    const stateResult = await pool.query('SELECT last_report_at FROM report_state WHERE id = 1');
    const lastReport = stateResult.rows[0].last_report_at;

    const countResult = await pool.query(
      'SELECT COUNT(*)::int as c FROM visits WHERE created_at > $1',
      [lastReport]
    );
    const count = countResult.rows[0].c;
    const hoursSince = (Date.now() - new Date(lastReport).getTime()) / 3600000;

    const shouldSend = count >= 10 || (count > 0 && hoursSince >= 3);

    if (shouldSend) {
      reportInFlight = true;
      try {
        const reason = count >= 10 ? 'threshold' : 'scheduled';
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

setInterval(checkReport, 60 * 1000);

// Start server after DB is ready
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
