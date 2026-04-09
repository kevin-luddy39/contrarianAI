const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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
}

// Email setup
let transporter = null;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'kevin.luddy39@gmail.com';

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

  // Send email notification (fire-and-forget)
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

// Start server after DB is ready
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
