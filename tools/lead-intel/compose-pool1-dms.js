#!/usr/bin/env node
// compose-pool1-dms.js
// Pulls unconverted audit_requests from prod DB and prints ready-to-paste
// personalized DMs for each lead. No DB writes. Read-only.
//
// Usage:
//   DATABASE_URL='postgres://...' node tools/lead-intel/compose-pool1-dms.js
//   DATABASE_URL='postgres://...' node tools/lead-intel/compose-pool1-dms.js --limit 10
//
// For Render's managed Postgres, grab DATABASE_URL from the DB instance
// page in the Render dashboard (External Database URL, not Internal).

const { Pool } = require('pg');

const STRIPE_LINK = 'https://buy.stripe.com/00w28sfq5gjS6Dg4Ia9IQ00';
const SENDER = 'Kevin';

const argv = process.argv.slice(2);
const limitArg = argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? parseInt(argv[limitArg + 1], 10) || 5 : 5;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var required.');
  console.error('Run: DATABASE_URL="postgres://..." node tools/lead-intel/compose-pool1-dms.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('sslmode=')
    ? { rejectUnauthorized: false }
    : false,
});

function renderDM(lead) {
  const pain = (lead.pain || '').trim();
  const painExcerpt = pain.length > 280 ? pain.slice(0, 280) + '...' : pain;
  const paraphrase = painExcerpt
    ? painExcerpt
    : (lead.ai_stack ? `your ${lead.ai_stack} setup` : 'your AI setup');
  const submittedOn = new Date(lead.created_at).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });
  const trackingLink = `${STRIPE_LINK}?ref=dm-audit-lead-${lead.id}`;

  return `
==============================================================
DM #${lead.id} -> ${lead.name || '(no name)'} <${lead.email || 'no email'}>
Company: ${lead.company || '(not provided)'} | Role: ${lead.role || 'n/a'} | Submitted: ${submittedOn}
Payment status: ${lead.payment_status || 'no_payment_sent'}
${lead.ai_stack ? `Stack: ${lead.ai_stack}` : ''}
--------------------------------------------------------------
SUBJECT: Quick offer for the audit you asked about

Hi ${lead.name ? lead.name.split(/\s+/)[0] : 'there'},

You filled out the contrarianAI audit form back in ${submittedOn} asking about:

  "${paraphrase}"

We never closed the loop on that - that's on me.

I'm productizing the audit work into a faster, cheaper SKU: the Bell Tuning
Rapid Audit. $2,500 flat, 48-hour turnaround. Five sensors run against
your retrieval / agent pipeline, 8-12 page PDF with flagged pathologies
and prioritized fixes, 30-min walkthrough call, 7 days of Q&A after.

Limited to 3 audits per week. Two slots open this week.

If your original ask is still unresolved, this is the fastest path to a
defensible answer. Pay link (no negotiation):

${trackingLink}

Or reply with current stack details and I'll confirm fit before you pay.

${SENDER}
==============================================================
`;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        ar.id,
        ar.name,
        ar.email,
        ar.company,
        ar.role,
        ar.pain,
        ar.ai_stack,
        ar.created_at,
        COALESCE(
          (SELECT status FROM payments p
           WHERE p.audit_request_id = ar.id
           ORDER BY created_at DESC LIMIT 1),
          'no_payment_sent'
        ) AS payment_status
      FROM audit_requests ar
      WHERE ar.created_at > NOW() - INTERVAL '12 months'
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.audit_request_id = ar.id
            AND p.status IN ('paid', 'succeeded', 'complete')
        )
      ORDER BY ar.created_at DESC
      LIMIT $1
    `, [LIMIT]);

    if (rows.length === 0) {
      console.log('No unconverted audit_requests found in the last 12 months.');
      console.log('Nothing in the warm pool - pivot to Pool 2 (Lead Intel contacts).');
      return;
    }

    console.log(`\nFound ${rows.length} unconverted audit_requests. Personalized DMs below.`);
    console.log('Copy the DM block, paste into email / LinkedIn / DM as appropriate.');
    console.log('Each link has a unique ?ref=dm-audit-lead-<id> tag for attribution.\n');

    for (const lead of rows) {
      console.log(renderDM(lead));
    }

    console.log('\n-- Summary --');
    console.log(`Leads: ${rows.length}`);
    console.log(`First: ${rows[0].name || rows[0].email} (${rows[0].company || 'no company'})`);
    console.log(`Oldest: ${new Date(rows[rows.length - 1].created_at).toLocaleDateString()}`);
    console.log(`\nNext: send DMs 1 per 10 min to avoid spam flags on LinkedIn / email.`);
    console.log(`Track responses: update tier to 'engaged' in lead-intel after each reply.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  if (err.code === '42P01') {
    console.error('audit_requests table missing. Wrong DB URL?');
  }
  process.exit(1);
});
