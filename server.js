const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Security headers
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// Visit tracking middleware — only counts page views, not assets
function isPageRequest(req) {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/api/')) return false;
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
app.use(express.static('landing'));

// Form submission endpoint
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

// Visit reporting
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
    `Window:          ${new Date(since).toISOString()}  →  ${new Date().toISOString()}`,
    `Total visits:    ${t.total}`,
    `Unique visitors: ${t.unique_visitors}`,
    `First visit:     ${t.first_visit ? new Date(t.first_visit).toISOString() : '—'}`,
    `Last visit:      ${t.last_visit ? new Date(t.last_visit).toISOString() : '—'}`,
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
    console.log(body);
  }

  // Reset window
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

// Check every 60 seconds
setInterval(checkReport, 60 * 1000);

// Start server after DB is ready
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
