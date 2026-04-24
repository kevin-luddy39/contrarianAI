#!/usr/bin/env node
// seed-manual-contacts.js
// Bulk-inserts manual contacts from a JSON file into the prod Postgres via
// the /api/admin/intel-contact endpoint. Skips duplicates by name+company
// match from the existing contacts list.
//
// Usage:
//   ADMIN_USER=... ADMIN_PASS=... node tools/lead-intel/seed-manual-contacts.js
//   ADMIN_USER=... ADMIN_PASS=... API_BASE=https://... node tools/lead-intel/seed-manual-contacts.js
//   ADMIN_USER=... ADMIN_PASS=... node tools/lead-intel/seed-manual-contacts.js path/to/file.json
//
// Env:
//   ADMIN_USER   — basic-auth user (required)
//   ADMIN_PASS   — basic-auth pass (required)
//   API_BASE     — default https://contrarianai-landing.onrender.com
//
// The JSON file is an array of contact objects. Required: at least one of
// name / email / linkedin_url / github_handle / twitter (endpoint enforces
// this). All other fields optional; they map directly to the contacts
// columns (tier, source, notes, company, role/title → bio, next_action).

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'https://contrarianai-landing.onrender.com';
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('ERROR: ADMIN_USER and ADMIN_PASS env vars required.');
  process.exit(1);
}

const fileArg = process.argv[2] || path.join(__dirname, 'manual-contacts.json');
const abs = path.resolve(fileArg);
if (!fs.existsSync(abs)) {
  console.error(`ERROR: input file not found: ${abs}`);
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

async function existingContacts() {
  const url = `${API_BASE}/api/admin/intel-contacts?limit=500`;
  const r = await fetch(url, { headers: { Authorization: AUTH } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET intel-contacts ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function postContact(body) {
  const r = await fetch(`${API_BASE}/api/admin/intel-contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let payload; try { payload = JSON.parse(txt); } catch { payload = { raw: txt }; }
  if (!r.ok) throw new Error(`POST ${r.status}: ${payload.error || txt.slice(0, 200)}`);
  return payload;
}

function keyOf(c) {
  const n = (c.name || '').trim().toLowerCase();
  const co = (c.company || '').trim().toLowerCase();
  const li = (c.linkedin_url || '').trim().toLowerCase();
  return li || `${n}|${co}`;
}

(async () => {
  const raw = fs.readFileSync(abs, 'utf8');
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('JSON file must be an array of contact objects');

  console.log(`[seed] source file: ${abs}`);
  console.log(`[seed] API base:    ${API_BASE}`);
  console.log(`[seed] records:     ${records.length}`);

  let existing = [];
  try {
    existing = await existingContacts();
    console.log(`[seed] existing prod contacts: ${existing.length}`);
  } catch (err) {
    console.warn(`[seed] warn: could not fetch existing contacts (${err.message}); continuing without dedup`);
  }
  const seen = new Set(existing.map(keyOf).filter(Boolean));

  let inserted = 0, skipped = 0, failed = 0;
  for (const rec of records) {
    const k = keyOf(rec);
    if (k && seen.has(k)) {
      console.log(`[skip] ${rec.name || rec.linkedin_url || '(anon)'} — already in prod`);
      skipped++;
      continue;
    }
    try {
      const res = await postContact(rec);
      console.log(`[ok]   id=${res.id} ${rec.name || rec.linkedin_url || rec.company || '(anon)'}`);
      inserted++;
      if (k) seen.add(k);
    } catch (err) {
      console.error(`[fail] ${rec.name || '(anon)'} — ${err.message}`);
      failed++;
    }
  }

  console.log(`[seed] done. inserted=${inserted} skipped=${skipped} failed=${failed}`);
})().catch(err => {
  console.error('[seed] fatal:', err.message);
  process.exit(1);
});
