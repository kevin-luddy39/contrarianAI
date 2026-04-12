function escape(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(cents) {
  if (cents == null) return '';
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function statusBadge(status) {
  const colors = {
    new: '#3b82f6',
    payment_sent: '#f59e0b',
    paid: '#22c55e',
    completed: '#6b7280',
    pending: '#f59e0b',
  };
  const color = colors[status] || '#6b7280';
  return `<span style="background:${color};color:#fff;padding:3px 10px;border-radius:4px;font-size:0.75rem;font-weight:600;text-transform:uppercase;">${escape(status || 'new')}</span>`;
}

function renderAdminPage({ requests, totals, stripeEnabled }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>contrarianAI Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  h1 span { color: #f97316; }
  .subtitle { color: #a3a3a3; font-size: 0.9rem; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: #141414; border: 1px solid #262626; border-radius: 8px; padding: 16px; }
  .stat-card .label { color: #a3a3a3; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-card .value { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }
  .stat-card .value.accent { color: #f97316; }
  .stat-card .value.success { color: #22c55e; }
  .warning { background: #422006; border: 1px solid #f59e0b; color: #fbbf24; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; background: #141414; border: 1px solid #262626; border-radius: 8px; overflow: hidden; }
  th { text-align: left; padding: 12px; background: #1f1f1f; font-size: 0.75rem; text-transform: uppercase; color: #a3a3a3; letter-spacing: 0.05em; border-bottom: 1px solid #262626; }
  td { padding: 12px; border-bottom: 1px solid #262626; font-size: 0.9rem; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .lead-name { font-weight: 600; color: #fff; }
  .lead-meta { color: #a3a3a3; font-size: 0.8rem; margin-top: 2px; }
  .lead-detail { color: #a3a3a3; font-size: 0.8rem; max-width: 280px; }
  details summary { cursor: pointer; color: #f97316; font-size: 0.8rem; }
  details[open] summary { margin-bottom: 6px; }
  .actions form { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }
  .actions input, .actions select { background: #0a0a0a; border: 1px solid #262626; color: #e5e5e5; padding: 6px 8px; border-radius: 4px; font-size: 0.85rem; font-family: inherit; }
  .actions button { background: #f97316; color: #000; border: none; padding: 8px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
  .actions button:hover { background: #fb923c; }
  .actions button:disabled { background: #525252; color: #a3a3a3; cursor: not-allowed; }
  .pay-link { display: block; background: #0a0a0a; border: 1px solid #262626; padding: 6px 8px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 0.7rem; color: #f97316; text-decoration: none; }
  .pay-link:hover { background: #1a1a1a; }
  .pay-meta { color: #a3a3a3; font-size: 0.75rem; margin-top: 4px; }
  .empty { text-align: center; padding: 40px; color: #a3a3a3; }
</style>
</head>
<body>

<h1>contrarian<span>AI</span> Admin</h1>
<p class="subtitle">Diagnostic requests &amp; payment management</p>

<div class="stats">
  <div class="stat-card">
    <div class="label">Total Leads</div>
    <div class="value">${totals.totalLeads}</div>
  </div>
  <div class="stat-card">
    <div class="label">New (no payment)</div>
    <div class="value accent">${totals.newLeads}</div>
  </div>
  <div class="stat-card">
    <div class="label">Payment Sent</div>
    <div class="value">${totals.paymentSent}</div>
  </div>
  <div class="stat-card">
    <div class="label">Paid</div>
    <div class="value success">${totals.paidLeads}</div>
  </div>
  <div class="stat-card">
    <div class="label">Total Revenue</div>
    <div class="value success">${fmtMoney(totals.totalRevenueCents)}</div>
  </div>
</div>

${!stripeEnabled ? `<div class="warning">⚠ Stripe is not configured. Set <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> in Render env vars to enable payment links.</div>` : ''}

<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Lead</th>
      <th>Details</th>
      <th>Status</th>
      <th>Payment</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    ${requests.length === 0 ? `<tr><td colspan="6" class="empty">No audit requests yet.</td></tr>` : requests.map(r => `
      <tr>
        <td style="white-space:nowrap;color:#a3a3a3;font-size:0.8rem;">${fmtDate(r.created_at)}</td>
        <td>
          <div class="lead-name">${escape(r.name)}</div>
          <div class="lead-meta">${escape(r.email)}</div>
          <div class="lead-meta">${escape(r.company)}${r.role ? ' &middot; ' + escape(r.role) : ''}</div>
        </td>
        <td class="lead-detail">
          ${r.ai_stack ? `<details><summary>AI Stack</summary>${escape(r.ai_stack)}</details>` : ''}
          ${r.pain ? `<details><summary>Pain</summary>${escape(r.pain)}</details>` : ''}
        </td>
        <td>${statusBadge(r.status)}</td>
        <td>
          ${r.payment_id ? `
            <div><strong>${fmtMoney(r.amount_cents)}</strong> &middot; ${statusBadge(r.payment_status)}</div>
            <a class="pay-link" href="${escape(r.stripe_session_url)}" target="_blank">${escape(r.stripe_session_url)}</a>
            <div class="pay-meta">Created ${fmtDate(r.payment_created_at)}${r.paid_at ? ' &middot; Paid ' + fmtDate(r.paid_at) : ''}</div>
          ` : '<span style="color:#a3a3a3;font-size:0.8rem;">No payment yet</span>'}
        </td>
        <td class="actions">
          <form method="POST" action="/admin/payment">
            <input type="hidden" name="audit_request_id" value="${r.id}">
            <input type="number" name="amount_usd" placeholder="Amount USD" min="1" step="0.01" required ${!stripeEnabled ? 'disabled' : ''}>
            <input type="text" name="description" placeholder="Description (optional)" ${!stripeEnabled ? 'disabled' : ''}>
            <button type="submit" ${!stripeEnabled ? 'disabled' : ''}>Create Payment Link</button>
          </form>
        </td>
      </tr>
    `).join('')}
  </tbody>
</table>

</body>
</html>`;
}

module.exports = { renderAdminPage, escape };
