const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbPath = path.join(dataDir, 'audit_requests.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT,
      ai_stack TEXT,
      pain TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
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
app.post('/api/audit-request', (req, res) => {
  const { name, email, company, role, ai_stack, pain } = req.body;

  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Name, email, and company are required.' });
  }

  try {
    db.run(
      'INSERT INTO audit_requests (name, email, company, role, ai_stack, pain) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, company, role || null, ai_stack || null, pain || null]
    );
    saveDb();
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
