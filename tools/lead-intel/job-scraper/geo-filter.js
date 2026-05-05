// Geographic filter for the application-intent path. Accepts:
//   - Remote / Anywhere
//   - Cities within 2-hour commute of 28429 (Castle Hayne NC) — see
//     kevin_profile_for_job_search.md for the canonical list
// Rejects everything else.

const REMOTE_RE = /\b(remote|anywhere|distributed|work\s+from\s+home|wfh|virtual)\b/i;

// City-name patterns that mean "in 2hr radius of 28429". Matches as
// case-insensitive substrings against the location string.
const IN_RANGE_CITIES = [
  // Wilmington area
  /\bwilmington[, ]+nc\b/i, /\bwilmington[, ]+north\s+carolina\b/i,
  /\bcastle\s+hayne\b/i, /\bleland[, ]+nc\b/i, /\bcarolina\s+beach\b/i, /\bwrightsville\b/i,
  // Coastal NC
  /\bjacksonville[, ]+nc\b/i, /\bcamp\s+lejeune\b/i, /\bnew\s+bern\b/i,
  /\bgreenville[, ]+nc\b/i, /\bgoldsboro\b/i, /\bkinston\b/i,
  // RTP / Triangle
  /\b(raleigh|cary|durham|chapel\s+hill|morrisville)[, ]+nc\b/i,
  /\bresearch\s+triangle\b/i, /\brtp\b/i, /\btriangle\s+park\b/i,
  // Fayetteville / Fort Liberty
  /\bfayetteville[, ]+nc\b/i, /\bfort\s+liberty\b/i, /\bfort\s+bragg\b/i,
  // Eastern SC
  /\b(myrtle\s+beach|conway|florence)[, ]+sc\b/i,
  /\bcharleston[, ]+sc\b/i,  // borderline ~2.25hr; accepting per profile note
  // State-only generic — borderline accept (will need follow-up review)
  /\bnorth\s+carolina\b/i, /\bnc\b(?![- ]\d)/i,  // bare "NC" not followed by route number
];

// Job-board "USA" / "United States" — accept conditionally if NOT also
// requiring onsite. We can't always tell; default to ACCEPT and flag.
const NATIONAL_RE = /\b(usa|us|united\s+states|nationwide)\b/i;

// Onsite-only signals — disqualifying when the city is out-of-range
const ONSITE_ONLY_RE = /\b(onsite\s+only|in[- ]office|no\s+remote|must\s+relocate|relocation\s+required)\b/i;

function classify(job) {
  const loc = (job.location || '').trim();
  const desc = job.description || '';
  const haystack = `${loc} ${desc}`;

  if (!loc && !desc) return { ok: true, reason: 'no-location-data', flag: 'unknown' };

  // 1. Remote — always accept
  if (REMOTE_RE.test(loc) || REMOTE_RE.test(desc.slice(0, 600))) {
    return { ok: true, reason: 'remote' };
  }

  // 2. In-range city
  for (const re of IN_RANGE_CITIES) {
    if (re.test(haystack)) return { ok: true, reason: 're-match', matched: re.source };
  }

  // 3. National posting that doesn't say onsite-only — accept conditionally
  if (NATIONAL_RE.test(loc) && !ONSITE_ONLY_RE.test(haystack)) {
    return { ok: true, reason: 'national-no-onsite-flag', flag: 'verify-on-apply' };
  }

  // 4. Default reject
  return { ok: false, reason: 'out-of-range', location: loc };
}

module.exports = { classify, IN_RANGE_CITIES, REMOTE_RE };
