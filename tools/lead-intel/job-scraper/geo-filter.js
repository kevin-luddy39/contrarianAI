// Geographic filter for the application-intent path. Accepts:
//   - Remote / Anywhere
//   - Cities within 2-hour commute of 28429 (Castle Hayne NC) — see
//     kevin_profile_for_job_search.md for the canonical list
// Rejects everything else.

const REMOTE_RE = /\b(remote|anywhere|distributed|work\s+from\s+home|wfh|virtual)\b/i;

// Non-US callouts that disqualify even "Remote" postings. Many jobs
// say "Remote - EU only" or "Remote LATAM" or "UK based, remote" —
// these all fail US-only mode.
const NON_US_LOCATION_RE = /\b(emea|eu\s+only|europe\s+only|uk\s+only|britain|united\s+kingdom|ireland|germany|france|spain|italy|portugal|netherlands|denmark|sweden|norway|finland|switzerland|austria|poland|romania|ukraine|latam|latin\s+america|brazil|mexico|argentina|colombia|chile|apac|asia[- ]pacific|asia\s+only|india\s+only|philippines|singapore|japan|china|hong\s+kong|australia|new\s+zealand|nz\s+only|canada\s+only|toronto|vancouver|montreal|africa)\b/i;
// Strong US positive signals that override ambiguous "Remote"
const US_POSITIVE_RE = /\b(united\s+states|usa\b|us\s+based|us\s+only|us\s+remote|americas|americas\s+only|pst|est|cst|mst|et\s+timezone|pt\s+timezone|ct\s+timezone|us\s+timezone|north\s+america)\b/i;

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

// US-state residency restrictions hidden in description even when the
// location field says "Remote". Patterns: "must reside in Texas",
// "remote only in California", "candidates outside of Florida", etc.
// Captures the in-range states (NC, SC) implicitly — a posting that
// requires NC or SC residency would actually be ACCEPTED, so the regex
// only flags when the required state is something OTHER than NC/SC.
const STATE_RESTRICT_RE = /(?:must\s+reside|reside(?:nt)?\s+(?:of|in)|located?\s+in|remote\s+only\s+in|candidates?\s+(?:must\s+be\s+)?(?:in|outside\s+(?:of\s+)?))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
const KEVIN_HOME_STATES_RE = /\b(north\s+carolina|nc|south\s+carolina|sc)\b/i;

function classify(job, opts = {}) {
  const { usOnly = false } = opts;
  const loc = (job.location || '').trim();
  const desc = job.description || '';
  const haystack = `${loc} ${desc}`;
  const headDesc = desc.slice(0, 800);

  if (!loc && !desc) return { ok: true, reason: 'no-location-data', flag: 'unknown' };

  // US-only mode: reject obvious non-US callouts BEFORE any accept rule.
  // Exception: if the posting also has a strong US positive signal AND
  // mentions another region, treat as multi-region (US-eligible).
  if (usOnly) {
    const isNonUs = NON_US_LOCATION_RE.test(haystack);
    const isUsPositive = US_POSITIVE_RE.test(haystack) ||
      [...IN_RANGE_CITIES.slice(0, 30)].some(r => r.test(haystack));
    if (isNonUs && !isUsPositive) {
      return { ok: false, reason: 'non-us-location', location: loc };
    }
    // Bare "Remote" with no US-positive signal AND with non-US headquarters
    // mentioned in the description — borderline. Reject when truly ambiguous.
    if (REMOTE_RE.test(loc) && !isUsPositive && /\bheadquarters?\s*:?\s*(?!.*(usa|united\s+states|us\b))/i.test(headDesc)) {
      // If headquarters is mentioned in desc but not US, reject
      const hq = headDesc.match(/headquarters?\s*:?\s*([^<\n]{0,80})/i);
      if (hq && !US_POSITIVE_RE.test(hq[1]) && !IN_RANGE_CITIES.some(r => r.test(hq[1]))) {
        if (NON_US_LOCATION_RE.test(hq[1])) {
          return { ok: false, reason: 'non-us-headquarters', location: loc, hq: hq[1].trim() };
        }
      }
    }
  }

  // 1. Remote — accept, BUT first check for hidden state-residency
  // restriction in description (e.g. "must reside in Texas")
  if (REMOTE_RE.test(loc) || REMOTE_RE.test(headDesc)) {
    // Scan first 1500 chars of description for state-residency restrictions
    const stateMatches = [...desc.slice(0, 1500).matchAll(STATE_RESTRICT_RE)];
    for (const sm of stateMatches) {
      const requiredState = sm[1];
      if (!requiredState) continue;
      // If the required state is one of Kevin's home states, fine
      if (KEVIN_HOME_STATES_RE.test(requiredState)) continue;
      // Skip generic words that the regex over-matched
      if (/^(the|this|our|your|their|all|any|every|some|most|each|both|either)$/i.test(requiredState.trim())) continue;
      // Real out-of-state restriction
      return { ok: false, reason: 'state-residency-restricted', state: requiredState.trim(), location: loc };
    }
    const flag = usOnly && !US_POSITIVE_RE.test(haystack) ? 'verify-us-eligibility' : undefined;
    return { ok: true, reason: 'remote', ...(flag ? { flag } : {}) };
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

module.exports = { classify, IN_RANGE_CITIES, REMOTE_RE, NON_US_LOCATION_RE, US_POSITIVE_RE };
