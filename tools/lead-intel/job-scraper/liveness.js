// Liveness check for job-board listings.
//
// SCOPE / LIMITATION (verified 2026-05-06):
// This catches LISTING-side dead URLs (404 / 410 / explicit "expired" body
// pattern on RemoteOK or WWR's own page). It does NOT catch COMPANY-side
// dead applies — Toast and Calabrio's WWR/RemoteOK listings rendered
// normally even though clicking Apply went to a "no longer available"
// company portal. The Apply URL on WWR/RemoteOK is behind a click; we don't
// see it from the listing page alone, and crawling each company's apply
// portal hits separate anti-bot + auth + JS-rendering challenges.
//
// Net: this is a best-effort coarse filter. ~70% of dead-listing waste
// comes from company-side pulls that this can't detect. Real defense is
// fresh scrape window (--since 7d) and accepting 1-2 dead clicks per
// session.
//
// CF (Cloudflare) challenge detection: when WWR/RemoteOK serve "Just a
// moment..." anti-bot page, we mark live=true with reason='cf-blocked'
// and a flag — don't false-drop, don't false-promise.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36';

const DEAD_PATTERNS = [
  /this\s+job\s+is\s+not\s+available\s+anymore/i,           // RemoteOK
  /the\s+page\s+you\s+are\s+trying\s+to\s+view\s+is\s+no\s+longer\s+available/i,  // WWR
  /this\s+(job|position|posting|opening)\s+(has\s+)?(been\s+)?(filled|closed|removed|expired|deleted)/i,
  /this\s+role\s+(is\s+)?(no\s+longer\s+(available|open)|has\s+been\s+(filled|closed))/i,
  /\bjob\s+expired\b/i,
  /position\s+(has\s+)?(been\s+)?filled/i,
  /no\s+longer\s+accepting\s+applications/i,
  /this\s+listing\s+(has\s+)?expired/i,
];

// Cloudflare bot-challenge fingerprints — when these match, we can't see the
// actual page body. Mark as "unknown" rather than asserting live/dead.
const CF_CHALLENGE_PATTERNS = [
  /<title>\s*Just\s+a\s+moment\.{0,3}\s*<\/title>/i,
  /cf-browser-verification|cf-challenge-running|__cf_chl_/i,
  /cloudflare[- ]?ray\s+id|cf[- ]?ray:/i,
  /enable\s+JavaScript\s+and\s+cookies\s+to\s+continue/i,
];

async function checkLive(url, opts = {}) {
  const { timeoutMs = 8000 } = opts;
  if (!url) return { live: true, reason: 'no-url' };  // can't check, assume live

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    clearTimeout(t);

    // Hard 4xx (except 403 anti-bot which we still treat as live-but-blocked)
    if (res.status === 404 || res.status === 410) {
      return { live: false, reason: `http-${res.status}`, finalUrl: res.url };
    }
    if (res.status >= 500) return { live: true, reason: `transient-${res.status}` };
    if (!res.ok && res.status !== 403) return { live: true, reason: `unknown-${res.status}` };
    if (res.status === 403) return { live: true, reason: 'http-403-anti-bot' };

    const html = await res.text();

    // Cloudflare challenge — we can't see real content. Flag as unknown.
    for (const re of CF_CHALLENGE_PATTERNS) {
      if (re.test(html)) {
        return {
          live: true, reason: 'cf-blocked-cant-verify',
          flag: 'maybe-stale-listing',
          finalUrl: res.url,
        };
      }
    }

    for (const re of DEAD_PATTERNS) {
      if (re.test(html)) {
        return { live: false, reason: 'body-pattern-match', pattern: re.source.slice(0, 50), finalUrl: res.url };
      }
    }
    return { live: true, reason: 'body-ok', finalUrl: res.url };
  } catch (e) {
    return { live: true, reason: `fetch-error: ${e.message}` };  // assume live on error
  }
}

module.exports = { checkLive, DEAD_PATTERNS };
