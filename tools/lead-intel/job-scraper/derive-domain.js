// Improved domain derivation. For each job, try in priority order:
//   1. URL explicitly mentioned in description text (often the company's
//      own site, since job posts include "URL: company.com" or "Apply at...")
//   2. apply_url hostname (when present and not a job-board aggregator)
//   3. Common slug variations: <slug>.com, <slug>.ai, <slug>.io, <slug>.co
//      verified via HEAD request (any 2xx/3xx = the domain resolves)
//   4. Fallback: <slug>.com unverified (logged as low-confidence)

const AGGREGATOR_RE = /(^|\.)(remoteok|weworkremotely|news\.ycombinator|hn\.algolia|workatastartup|wellfound|dice|indeed|glassdoor|linkedin|ycombinator|github|jobs\.ashbyhq|greenhouse|lever|smartrecruiters|workable)\.com$/i;

const GENERIC_RE = /^(www|jobs|careers|apply|join|company|info|app|api|cdn|static|assets|images?|media|docs|help|support|blog|about|contact)\./i;

// Common URL patterns inside HTML/text job descriptions
const URL_RE = /(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]{0,60}\.(?:com|ai|io|co|net|app|dev|tech|cloud|gg|so|sh|xyz))(?:\/[^\s"'<>]*)?/gi;

function slugifyCompany(company) {
  return (company || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|corp|corporation|llc|ltd|co|group)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Generate multiple plausible slugs for a company name, in priority order.
// "Arize AI" -> ["arize", "arizeai"]
// "Trunk Tools, Inc" -> ["trunktools", "trunk"]
// "Calibrate Group AI" -> ["calibrategroup", "calibrate", "calibrategroupai"]
// "Andromeda Cluster" -> ["andromeda", "andromedacluster"]
function slugVariants(company) {
  const out = [];
  const seen = new Set();
  const push = (s) => { if (s && s.length >= 3 && !seen.has(s)) { seen.add(s); out.push(s); } };

  const raw = (company || '').toLowerCase();
  // Stripped-to-tokens version
  const tokens = raw
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const STOP_SUFFIXES = new Set(['inc', 'corp', 'corporation', 'llc', 'ltd', 'co', 'company', 'labs', 'lab']);
  const STRIPPABLE_TRAILING = new Set(['ai', 'ml', 'io', 'app', 'group', 'tech', 'cluster', 'tools']);

  // 1. Trim trailing legal suffixes (always)
  const cleanTokens = tokens.filter(t => !STOP_SUFFIXES.has(t));
  // 2a. Full clean slug
  push(cleanTokens.join(''));
  // 2b. Full slug minus the last "strippable" trailing token (e.g. "AI", "Group")
  if (cleanTokens.length >= 2) {
    const last = cleanTokens[cleanTokens.length - 1];
    if (STRIPPABLE_TRAILING.has(last)) {
      push(cleanTokens.slice(0, -1).join(''));
    }
  }
  // 2c. First token alone (often the brand name)
  push(cleanTokens[0]);
  // 2d. First two tokens
  if (cleanTokens.length >= 2) push(cleanTokens.slice(0, 2).join(''));
  // 2e. Original full slug including suffixes (last resort)
  push(slugifyCompany(company));

  return out;
}

function extractDomainsFromText(text, companySlug) {
  if (!text) return [];
  const out = [];
  // Highest-confidence: explicit "URL:" / "Website:" / "Visit:" declaration
  // followed by a URL within ~80 chars
  const explicitRe = /(?:URL|Website|Visit|Homepage|Site)\s*:?\s*<?(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]{0,60}\.(?:com|ai|io|co|net|app|dev|tech|cloud|gg|so|sh|xyz))/gi;
  let m;
  while ((m = explicitRe.exec(text)) !== null) {
    const host = m[1].toLowerCase();
    if (!AGGREGATOR_RE.test(host)) out.push({ host, confidence: 'explicit' });
  }
  // Lower-confidence: any URL in text whose registrable name shares 4+ chars
  // with the company slug. Filters out unrelated URLs like booking.com /
  // verint.com that get sprinkled into descriptions.
  while ((m = URL_RE.exec(text)) !== null) {
    const host = m[1].toLowerCase();
    if (AGGREGATOR_RE.test(host)) continue;
    const parts = host.split('.');
    const reg = parts.length >= 2 ? parts.slice(-2).join('.') : host;
    const regSlug = reg.split('.')[0];
    if (companySlug && regSlug.length >= 4 && companySlug.length >= 4) {
      // Substring match either way
      if (regSlug.includes(companySlug) || companySlug.includes(regSlug) ||
          // Or first 4 chars match
          regSlug.slice(0, 4) === companySlug.slice(0, 4)) {
        out.push({ host: reg, confidence: 'slug-match' });
      }
    }
  }
  URL_RE.lastIndex = 0;
  // Dedupe preserving first occurrence (highest confidence)
  const seen = new Set();
  return out.filter(d => {
    if (seen.has(d.host)) return false;
    seen.add(d.host);
    return true;
  });
}

function hostnameFrom(u) {
  try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

async function headOk(domain, timeoutMs = 5000) {
  for (const proto of ['https', 'http']) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${proto}://${domain}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contrarianai-bot/0.1)' },
      });
      clearTimeout(t);
      if (res.ok || (res.status >= 200 && res.status < 400)) return true;
    } catch { /* try next proto */ }
  }
  return false;
}

// Stronger validation: GET the page and check the <title> contains at least
// one brand-relevant token from the company name. This catches the case
// where a domain RESOLVES (HEAD-OK) but is owned by a different company
// (e.g. haast.com is generic, real Haast = haast.io).
async function titleMatches(domain, brandTokens, timeoutMs = 8000) {
  for (const proto of ['https', 'http']) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${proto}://${domain}`, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; contrarianai-bot/0.1)' },
      });
      clearTimeout(t);
      if (!res.ok && (res.status < 200 || res.status >= 400)) continue;
      const html = await res.text();
      const tm = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = (tm ? tm[1] : '').toLowerCase();
      const meta = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i) || [, ''])[1].toLowerCase();
      const og = (html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)/i) || [, ''])[1].toLowerCase();
      const haystack = `${title} ${meta} ${og}`;
      // Reject obvious parking / for-sale pages
      if (/this domain (may be |is )?for sale|domain parking|buy this domain|hugedomains|godaddy auction/i.test(haystack)) {
        return { ok: false, reason: 'parked', title };
      }
      for (const tok of brandTokens) {
        if (tok.length >= 3 && haystack.includes(tok.toLowerCase())) {
          return { ok: true, title, matchedToken: tok };
        }
      }
      return { ok: false, reason: 'no-brand-match', title };
    } catch { /* try next proto */ }
  }
  return { ok: false, reason: 'fetch-failed' };
}

function brandTokensFor(company) {
  const tokens = (company || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => !['inc', 'corp', 'corporation', 'llc', 'ltd', 'co', 'company', 'group', 'the'].includes(t));
  return tokens;
}

async function deriveDomain(job, opts = {}) {
  const { verify = true, validateTitle = true } = opts;
  const tried = [];
  const tokens = brandTokensFor(job.company);

  // Wrapper: HEAD-check + (optionally) title-check
  async function accept(domain) {
    if (!verify) return true;
    if (!await headOk(domain)) return false;
    if (!validateTitle) return true;
    const t = await titleMatches(domain, tokens);
    return t.ok;
  }

  const slug = slugifyCompany(job.company);

  // 1. URLs in description text — explicit (URL: ...) wins, slug-match second
  const fromDesc = extractDomainsFromText(job.description || '', slug)
    .filter(d => !/amazonaws|cloudfront|googleapis|fastly/.test(d.host));
  for (const cand of fromDesc) {
    tried.push(cand.host);
    if (await accept(cand.host)) {
      return { domain: cand.host, source: `desc-${cand.confidence}`, tried };
    }
  }

  // 2. apply_url
  if (job.apply_url) {
    const h = hostnameFrom(job.apply_url);
    if (h && !AGGREGATOR_RE.test(h)) {
      const parts = h.split('.');
      const reg = parts.length >= 2 ? parts.slice(-2).join('.') : h;
      tried.push(reg);
      if (await accept(reg)) return { domain: reg, source: 'apply_url', tried };
    }
  }

  // 3. Multi-slug × multi-TLD variants. Title-validated.
  const variants = slugVariants(job.company);
  if (variants.length) {
    const aiCo = /\bai\b/i.test(job.company || '');
    const tlds = aiCo ? ['com', 'ai', 'io', 'co'] : ['com', 'ai', 'io', 'co'];
    for (const v of variants) {
      for (const tld of tlds) {
        const cand = `${v}.${tld}`;
        tried.push(cand);
        if (await accept(cand)) return { domain: cand, source: `slug-${v}-${tld}`, tried };
      }
    }
  }

  // 4. Fallback: unverified slug.com
  return { domain: slug ? slug + '.com' : null, source: 'fallback-unverified', tried };
}

module.exports = { deriveDomain, extractDomainsFromText, slugifyCompany, AGGREGATOR_RE };
