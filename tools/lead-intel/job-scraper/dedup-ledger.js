// Stealth-mode dedup ledger. Reads manual-contacts.json + the per-day
// scraped enriched outputs to determine which companies are in active
// outreach (Bell Tuning cold-email) windows and therefore must be
// excluded from the application-intent path.
//
// "Active outreach window" = touchpoint within last N days (default 14).
// After window closes, company becomes eligible for application-path.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const CONTACTS_PATH = path.join(REPO_ROOT, 'tools', 'lead-intel', 'manual-contacts.json');

function normalizeCompany(s) {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(inc|corp|corporation|llc|ltd|co|company|group)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadOutreachLedger(windowDays = 14) {
  if (!fs.existsSync(CONTACTS_PATH)) return new Map();
  const contacts = JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf8'));
  const cutoff = new Date(Date.now() - windowDays * 86400 * 1000);

  const ledger = new Map();  // normalized-company -> { last_touchpoint_ts, intent, source }
  for (const c of contacts) {
    const tps = Array.isArray(c.touchpoints) ? c.touchpoints : [];
    if (!tps.length) continue;
    // Most recent touchpoint
    const sorted = tps.slice().sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    const latest = sorted[0];
    if (!latest.ts) continue;
    let latestDate;
    try { latestDate = new Date(latest.ts); } catch { continue; }
    if (latestDate < cutoff) continue;  // outside window, ineligible to block

    const key = normalizeCompany(c.company || c.name);
    if (!key) continue;
    ledger.set(key, {
      company: c.company || c.name,
      last_touchpoint_ts: latest.ts,
      latest_action: latest.action || '',
      contact_email: c.email || null,
      tier: c.tier || null,
      source: c.source || 'manual-contacts',
    });
  }
  return ledger;
}

function isCompanyInActiveOutreach(company, ledger) {
  const key = normalizeCompany(company);
  return ledger.get(key) || null;
}

module.exports = { loadOutreachLedger, isCompanyInActiveOutreach, normalizeCompany };
