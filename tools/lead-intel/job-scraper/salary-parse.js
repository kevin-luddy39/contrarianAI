// Salary parsing + floor filter. Extracts comp from job title/description,
// handles common formats ($120k-$180k, €60-90k, 120,000-180,000), converts
// non-USD to USD at rough rates, returns the LOW end of the range for
// floor-check purposes.

const FX_TO_USD = { '$': 1.0, USD: 1.0, '€': 1.10, EUR: 1.10, '£': 1.30, GBP: 1.30, 'C$': 0.74, CAD: 0.74, A$: 0.66, AUD: 0.66 };

// Match patterns like "$120k", "$120,000", "120k", "$120-180k", "€60k-€90k"
// Capture: optional currency symbol/code + low + (optional high) + optional 'k'
const SALARY_RE = /(?:[\$€£])\s*(\d{2,3}(?:[,.]\d{3})?)\s*(k\b)?(?:\s*[-–to]+\s*(?:[\$€£])?\s*(\d{2,3}(?:[,.]\d{3})?)\s*(k\b)?)?/gi;
// Also catch "USD 120k", "EUR 60-90k" code-based
const SALARY_CODE_RE = /\b(USD|EUR|GBP|CAD|AUD)\s*(\d{2,3}(?:[,.]\d{3})?)\s*(k\b)?(?:\s*[-–to]+\s*(\d{2,3}(?:[,.]\d{3})?)\s*(k\b)?)?/gi;
// "120k+" or "from 120k"
const SALARY_FLOOR_RE = /(?:from|starting\s+at|min(?:imum)?)\s*[\$€£]?\s*(\d{2,3})\s*k?\b|(?:[\$€£])(\d{2,3})\s*k?\s*\+/gi;

function normalizeAmount(rawNum, kFlag) {
  if (!rawNum) return null;
  const cleaned = rawNum.replace(/[,.]/g, '');
  let n = parseInt(cleaned, 10);
  if (isNaN(n)) return null;
  // If "k" suffix OR the number is small (<1000), treat as thousands
  if (kFlag || n < 1000) n = n * 1000;
  return n;
}

function detectCurrency(haystackSnippet, symbolMatch) {
  if (symbolMatch) {
    if (symbolMatch.includes('€')) return 'EUR';
    if (symbolMatch.includes('£')) return 'GBP';
    if (symbolMatch.includes('$')) return 'USD';
  }
  // Code-based: parsed elsewhere
  return 'USD';  // default assume USD
}

function parseSalary(text) {
  if (!text) return { found: false };
  // Fix common mojibake from UTF-8 decoded as Latin-1 then re-encoded.
  // The euro sign €  (UTF-8 bytes E2 82 AC) shows up in feeds as the 3-char
  // sequence \u00E2\u0082\u00AC. Pound £ (C2 A3) shows as \u00C2\u00A3.
  // Em-dash and en-dash similar (E2 80 93/94).
  let t = text
    .replace(/\u00E2\u0082\u00AC/g, '€')   // EUR mojibake
    .replace(/\u00C2\u00A3/g, '£')          // GBP mojibake
    .replace(/\u00E2\u0080\u0093/g, '-')    // en-dash mojibake -> hyphen
    .replace(/\u00E2\u0080\u0094/g, '-')    // em-dash mojibake -> hyphen
    .replace(/\u00E2\u0080\u0099/g, "'")    // right single quote mojibake
    .replace(/&euro;/gi, '€')
    .replace(/&pound;/gi, '£');
  t = t.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/&#\d+;/g, ' ');

  // Find all matches; prefer the one with the WIDEST/HIGHEST values
  // (often there are noise numbers; the salary range tends to be the largest pair)
  const candidates = [];

  let m;
  while ((m = SALARY_RE.exec(t)) !== null) {
    const sym = m[0].match(/[€£\$]/)?.[0] || '$';
    const low = normalizeAmount(m[1], !!m[2]);
    const high = m[3] ? normalizeAmount(m[3], !!m[4]) : null;
    if (!low) continue;
    if (low < 30000) continue;  // too small to be salary; probably page count or feature value
    candidates.push({ low, high, currency: detectCurrency(t, sym), source: 'symbol' });
  }
  SALARY_RE.lastIndex = 0;

  while ((m = SALARY_CODE_RE.exec(t)) !== null) {
    const code = m[1].toUpperCase();
    const low = normalizeAmount(m[2], !!m[3]);
    const high = m[4] ? normalizeAmount(m[4], !!m[5]) : null;
    if (!low) continue;
    if (low < 30000) continue;
    candidates.push({ low, high, currency: code, source: 'code' });
  }
  SALARY_CODE_RE.lastIndex = 0;

  while ((m = SALARY_FLOOR_RE.exec(t)) !== null) {
    const num = m[1] || m[2];
    const low = normalizeAmount(num, true);
    if (!low) continue;
    if (low < 30000) continue;
    candidates.push({ low, high: null, currency: 'USD', source: 'floor' });
  }
  SALARY_FLOOR_RE.lastIndex = 0;

  if (!candidates.length) return { found: false };

  // Pick the highest-low among candidates (most likely the actual salary range)
  candidates.sort((a, b) => b.low - a.low);
  const best = candidates[0];

  const fx = FX_TO_USD[best.currency] || 1.0;
  const lowUsd = Math.round(best.low * fx);
  const highUsd = best.high ? Math.round(best.high * fx) : null;

  return {
    found: true,
    low: best.low, high: best.high,
    currency: best.currency,
    low_usd: lowUsd, high_usd: highUsd,
    fx_rate: fx,
    snippet: best.source,
  };
}

function passesFloor(salary, minUsd) {
  if (!salary || !salary.found) return { ok: true, reason: 'undisclosed', flag: 'verify-comp-on-apply' };
  if (salary.low_usd >= minUsd) return { ok: true, reason: 'meets-floor' };
  // If high-end meets floor (and low doesn't), still flag but accept
  if (salary.high_usd && salary.high_usd >= minUsd) {
    return { ok: true, reason: 'high-end-meets-floor', flag: 'low-end-below-floor' };
  }
  return { ok: false, reason: 'below-floor', salary };
}

module.exports = { parseSalary, passesFloor, FX_TO_USD };
