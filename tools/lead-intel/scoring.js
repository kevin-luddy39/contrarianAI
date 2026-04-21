// Engagement + ICP scoring.

const { SCORE_WEIGHTS, ICP_KEYWORDS, ANTI_KEYWORDS } = require('./config');

function scoreEvents(events) {
  let s = 0;
  for (const e of events) {
    const w = SCORE_WEIGHTS[e.event_type] ?? 0;
    s += w;
  }
  return s;
}

function scoreIcp(contact) {
  const text = [contact.bio, contact.company, contact.name, contact.location].filter(Boolean).join(' ');
  if (!text) return { score: 0, hits: [] };
  const hits = [];
  let score = 0;
  for (const { rx, weight, label } of ICP_KEYWORDS) {
    if (rx.test(text)) { score += weight; hits.push(label); }
  }
  for (const { rx, weight, label } of ANTI_KEYWORDS) {
    if (rx.test(text)) { score += weight; hits.push(label); }
  }
  if (contact.followers_count >= 500) { score += 5; hits.push('high-reach'); }
  return { score, hits };
}

// Suggested next action given tier + score + what's known.
function suggestAction(contact) {
  const { tier, email, icp_fit, engagement_score, next_action } = contact;
  if (next_action) return next_action;

  if (engagement_score >= 60) return 'Hot: personal DM w/ audit offer';
  if (tier === 'pr_author') return 'PR author — respond + offer call';
  if (tier === 'issue_author') return 'Issue author — acknowledge + probe use case';
  if (tier === 'fork') return 'Fork — check fork, comment on derivative work';
  if (tier === 'watcher') return 'Watcher — high intent, DM pointed question';
  if (tier === 'star' && icp_fit >= 10) return 'ICP star — DM w/ specific pathology question';
  if (tier === 'star' && email) return 'Star w/ email — send whitepaper PDF';
  if (tier === 'star') return 'Star — reply to their recent content or profile visit';
  return 'Enrich profile + re-evaluate';
}

module.exports = { scoreEvents, scoreIcp, suggestAction };
