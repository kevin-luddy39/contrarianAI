// Pain-phrase patterns. Match these in posts/comments to identify
// authors actively struggling with AI/RAG/agent failures in production.
// Higher-confidence phrases = higher pain-score.

const PAIN_PATTERNS = [
  // Highest-confidence: someone explicitly stuck/frustrated
  { kw: /\bcan('t|not)\s+figure\s+out\s+why\b/i, score: 20, tag: 'cant-figure-out' },
  { kw: /\bspent\s+\d+\s+(hours?|days?)\s+(debug|trying|figur|chasing)/i, score: 18, tag: 'time-sunk' },
  { kw: /\b(silent(ly)?\s+(fail|fails|failing)|fails\s+silent)/i, score: 18, tag: 'silent-fail' },
  { kw: /\bregression\s+in\s+(prod|production)\b/i, score: 15, tag: 'prod-regression' },
  { kw: /\beval(uation)?(s)?\s+pass(es|ed)?\s+but\b/i, score: 18, tag: 'eval-passes-but' },

  // High-confidence: production-AI specific failures
  { kw: /\b(rag|retrieval)\s+(fail|fails|failing|broken|wrong|bad)/i, score: 15, tag: 'rag-failure' },
  { kw: /\bagent\s+(stuck|loops?|loop(ing|s)?|hallucinat|got\s+confused)/i, score: 15, tag: 'agent-stuck' },
  { kw: /\bhallucinat\w*\s+in\s+(prod|production)/i, score: 16, tag: 'hallucinate-prod' },
  { kw: /\b(wrong|incorrect|bad)\s+tool\s+call/i, score: 15, tag: 'tool-call-wrong' },
  { kw: /\bcontext\s+(loss|losing|window\s+(degrad|rot|fail))/i, score: 14, tag: 'context-degrade' },
  { kw: /\b(rank\s+inversion|score\s+miscalibrat|chunks?\s+ranked\s+wrong)/i, score: 20, tag: 'rank-inversion-explicit' },
  { kw: /\bprecision@\s*\d+\s+(passes|says|reports)\s+but/i, score: 18, tag: 'precision-misleading' },

  // Medium-confidence: pain-shaped framing
  { kw: /\b(my|our)\s+(rag|agent|llm|model|app)\s+(is|keeps?|started)\s+\w+ing\s+(wrong|bad|weird|off)/i, score: 12, tag: 'mine-misbehaving' },
  { kw: /\bintermittent\s+(failure|bug|issue|problem)/i, score: 12, tag: 'intermittent' },
  { kw: /\bcustomer(s)?\s+(complain|reporting|saying)/i, score: 12, tag: 'customer-complaints' },
  { kw: /\b(answer|output|response)s?\s+(feel|feels|are)\s+off\b/i, score: 13, tag: 'output-feels-off' },
  { kw: /\bdrift(ing|ed)?\s+(silently|over\s+time)/i, score: 13, tag: 'drift' },
  { kw: /\bworks\s+in\s+dev\s+(but|fails)/i, score: 12, tag: 'dev-vs-prod' },
  { kw: /\b(no|don't|can't)\s+(idea|clue|know)\s+(why|where|what)/i, score: 10, tag: 'mystery' },

  // Lower-confidence: general AI-pain shape
  { kw: /\bobservab(ility|le)\s+(gap|missing|hard|need)/i, score: 8, tag: 'observability-gap' },
  { kw: /\b(debug|debugging)\s+(agent|llm|rag|ai)/i, score: 7, tag: 'debug' },
  { kw: /\bhelp\s+me\s+(figure|understand|debug)/i, score: 6, tag: 'help-request' },
  { kw: /\bany(one|body)\s+(else)?\s*(seen|run\s+into|having)/i, score: 6, tag: 'others-seen-this' },
];

// Anti-patterns: vendor-shape signals. Authors pitching their own solution
// in pain-shaped framing (problem-solution structure), not feeling the pain
// as buyers.
const ANTI_PATTERNS = [
  // Direct builder/vendor signals
  /\b(we|our|i('ve)?|I)\s+built\s+(a|an|this|the|something|our)/i,
  /\b(we|our|i('ve)?|I)\s+(created|made|developed|designed)\s+(a|an|this|our)/i,
  /\b(we|our|i('ve)?|I)\s+(have\s+)?been\s+(building|working|developing)\s+(on\s+)?(a|an|this|our)/i,
  /\b(introducing|introducing\s+the)\s+\w+/i,
  /\b(announcing|announce|launched|launching)\s+\w+/i,
  /\b(we|i)\s+ended\s+up\s+(experimenting|building|creating|making)/i,
  /\bcheck\s+(it|this)\s+out\b/i,
  /\bshow\s+hn\b/i,
  /\bproudly\s+announc/i,
  /\bjust\s+launched\b/i,
  /\bwe('re|\s+are)\s+hiring\b/i,
  /\bsponsored\b/i,

  // Structural: feature-list bullets + "curious what others think" = soft-pitch
  /\bcurious\s+(how|what)\s+others?\s+(are\s+(handling|doing|solving)|(think|see))/i,
  /\b(would\s+love|love\s+to\s+hear)\s+(your|other|community)\s+(feedback|thoughts|input)/i,

  // Self-promotion patterns
  /\b(github\.com\/[^\/]+\/|github:\s)/i,  // dropping a github link in own post
  /\b(here'?s|this\s+is)\s+(my|our)\s+(repo|project|tool|library|approach|solution)/i,

  // Open-source announcement framing
  /\bopen[- ]?source(d|ing)?\s+(my|our|this|the)/i,

  // Long-form essay structure (vendors write LONG posts; buyers ask SHORT questions)
  // Note: scoring length-based handled in score function, not here as regex
];

// Buyer-shape positive signals (BOOST when these match — strong help-request shape)
const BUYER_BOOSTS = [
  /\b(help|please\s+help)\b/i,
  /\b(any(one|body)\s+(tried|done|seen|run\s+into))\b/i,
  /\b(stuck|stumped|confused|lost)\b/i,
  /\b(what('s|\s+am\s+i)\s+(missing|doing\s+wrong))\b/i,
  /\bbeen\s+stuck\s+on\s+this/i,
  /\bcan(not|'t)\s+figure\s+(it|this|out)/i,
  /\bdebugging\s+for\s+\d+\s+(hour|day)/i,
  /\bquestion\b/i,
];

function scorePainText(text) {
  if (!text) return { score: 0, tags: [], anti: false, anti_reasons: [], buyer_boosts: [] };
  const t = text.toLowerCase();
  let score = 0;
  const tags = [];
  for (const { kw, score: w, tag } of PAIN_PATTERNS) {
    if (kw.test(t)) {
      score += w;
      tags.push(tag);
    }
  }

  // Anti: each match deducts 8, multiple matches compound (vendors hit several)
  const anti_reasons = [];
  for (const re of ANTI_PATTERNS) {
    if (re.test(t)) anti_reasons.push(re.source.slice(0, 50));
  }
  score -= anti_reasons.length * 8;

  // Buyer boosts: each match adds 5
  const buyer_boosts = [];
  for (const re of BUYER_BOOSTS) {
    if (re.test(t)) buyer_boosts.push(re.source.slice(0, 30));
  }
  score += buyer_boosts.length * 5;

  // Length penalty: vendor posts tend to be long-form essays (~1500+ chars).
  // Buyer pain posts are usually shorter help-requests (~200-700 chars).
  const charLen = text.length;
  if (charLen > 2000) score -= 10;       // long post = vendor likely
  else if (charLen < 150) score -= 5;    // too short = noise / link drop
  else if (charLen >= 200 && charLen <= 800) score += 3;  // buyer-shape sweet spot

  if (score < 0) score = 0;
  return {
    score, tags,
    anti: anti_reasons.length > 0,
    anti_reasons,
    buyer_boosts,
    char_len: charLen,
  };
}

module.exports = { scorePainText, PAIN_PATTERNS, ANTI_PATTERNS, BUYER_BOOSTS };
