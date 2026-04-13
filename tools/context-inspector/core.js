/**
 * Context Inspector — Core Analysis Engine
 *
 * Analyzes text content for domain alignment and user alignment,
 * producing statistical distributions visualized as bell curves.
 *
 * Shared by CLI, MCP server, and web UI.
 */

// ── Optional dependencies (graceful fallback) ──────────────
let nlp, encode, lda;
try { nlp = require('compromise'); } catch { nlp = null; }
try { encode = require('gpt-tokenizer').encode; } catch { encode = null; }
try { lda = require('lda'); } catch { lda = null; }

// ── Porter Stemmer (inline, no dependency) ─────────────────
const STEP2_MAP = {ational:'ate',tional:'tion',enci:'ence',anci:'ance',izer:'ize',abli:'able',alli:'al',entli:'ent',eli:'e',ousli:'ous',ization:'ize',ation:'ate',ator:'ate',alism:'al',iveness:'ive',fulness:'ful',ousness:'ous',aliti:'al',iviti:'ive',biliti:'ble'};
const STEP3_MAP = {icate:'ic',ative:'',alize:'al',iciti:'ic',ical:'ic',ful:'',ness:''};

function porterStem(w) {
  if (w.length < 3) return w;
  // Step 1a
  if (w.endsWith('sses')) w = w.slice(0,-2);
  else if (w.endsWith('ies')) w = w.slice(0,-2);
  else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0,-1);
  // Step 1b
  const re1b = /^(.+?)(eed|ed|ing)$/;
  const m1b = re1b.exec(w);
  if (m1b) {
    const stem = m1b[1];
    const suf = m1b[2];
    if (suf === 'eed') { if (/[aeiouy][^aeiouy]/.test(stem)) w = stem + 'ee'; }
    else if (/[aeiouy]/.test(stem)) {
      w = stem;
      if (/at$|bl$|iz$/.test(w)) w += 'e';
      else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0,-1);
      else if (/^[^aeiouy]*[aeiouy][^aeiouywxyz]$/.test(w)) w += 'e';
    }
  }
  // Step 1c
  if (/[aeiouy].+y$/.test(w)) w = w.slice(0,-1) + 'i';
  // Step 2
  for (const [suf, rep] of Object.entries(STEP2_MAP)) {
    if (w.endsWith(suf)) { const s = w.slice(0, -suf.length); if (/[aeiouy][^aeiouy]/.test(s)) w = s + rep; break; }
  }
  // Step 3
  for (const [suf, rep] of Object.entries(STEP3_MAP)) {
    if (w.endsWith(suf)) { const s = w.slice(0, -suf.length); if (/[aeiouy][^aeiouy]/.test(s)) w = s + rep; break; }
  }
  // Step 4
  const s4 = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ion|ou|ism|ate|iti|ous|ive|ize)$/;
  const m4 = s4.exec(w);
  if (m4) { const s = m4[1]; if (/[aeiouy][^aeiouy].*[aeiouy][^aeiouy]/.test(s)) w = s; }
  // Step 5a
  if (w.endsWith('e')) { const s = w.slice(0,-1); if (/[aeiouy][^aeiouy].*[aeiouy][^aeiouy]/.test(s) || (/[aeiouy][^aeiouy]/.test(s) && !/[^aeiouy][aeiouy][^aeiouywxyz]$/.test(s))) w = s; }
  // Step 5b
  if (/ll$/.test(w) && /[aeiouy][^aeiouy].*[aeiouy][^aeiouy]/.test(w)) w = w.slice(0,-1);
  return w;
}

// ── Negation handling ──────────────────────────────────────
const NEGATION_WORDS = new Set(['not','no','never','neither','nor','nobody','nothing','nowhere','hardly','scarcely','barely','cannot','cant','dont','doesnt','didnt','wont','wouldnt','shouldnt','couldnt','isnt','arent','wasnt','werent','hasnt','havent','hadnt']);
const NEGATION_WINDOW = 3; // words after negation to flip

function applyNegation(tokens) {
  const result = [];
  let negScope = 0;
  for (const t of tokens) {
    if (NEGATION_WORDS.has(t.replace(/'/g, ''))) {
      negScope = NEGATION_WINDOW;
      continue; // drop the negation word itself
    }
    if (negScope > 0) {
      result.push('NOT_' + t);
      negScope--;
    } else {
      result.push(t);
    }
  }
  return result;
}

// ── Stopwords ──────────────────────────────────────────────
const STOPWORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and','any','are',
  'aren','as','at','be','because','been','before','being','below','between','both',
  'but','by','can','could','d','did','didn','do','does','doesn','doing','don','down',
  'during','each','few','for','from','further','get','got','had','hadn','has','hasn',
  'have','haven','having','he','her','here','hers','herself','him','himself','his',
  'how','i','if','in','into','is','isn','it','its','itself','just','ll','m','ma',
  'me','might','more','most','must','mustn','my','myself','need','no','nor','not',
  'now','o','of','off','on','once','only','or','other','our','ours','ourselves','out',
  'over','own','re','s','same','shall','shan','she','should','shouldn','so','some',
  'such','t','than','that','the','their','theirs','them','themselves','then','there',
  'these','they','this','those','through','to','too','under','until','up','ve','very',
  'was','wasn','we','were','weren','what','when','where','which','while','who','whom',
  'why','will','with','won','would','wouldn','y','you','your','yours','yourself',
  'yourselves','also','well','like','use','used','using','one','two','three','new',
  'way','may','even','much','many','make','see','come','take','still','know','back',
  'first','last','long','great','little','right','old','big','high','different','small',
  'next','put','end','thing','things','work','part','case','point','think','try',
]);

// ── User signal patterns ───────────────────────────────────
const USER_PATTERNS = [
  /\byou\b/gi, /\byour\b/gi, /\byours\b/gi, /\byourself\b/gi,
  /\buser\b/gi, /\busers\b/gi, /\bclient\b/gi, /\bcustomer\b/gi,
  /\bplease\b/gi, /\bprefer\b/gi, /\bwant\b/gi, /\bneed\b/gi,
  /\bshould\b/gi, /\brequire\b/gi, /\brequirement\b/gi,
  /\bspecif(?:y|ic|ically)\b/gi, /\bcustom\b/gi,
  /\bpersonali[sz]e\b/gi, /\bconfigure\b/gi, /\bsetting\b/gi,
  /\brole\b/gi, /\bgoal\b/gi, /\btask\b/gi, /\bworkflow\b/gi,
  /\binstruct(?:ion|ions)?\b/gi, /\bdirect(?:ive|ly)?\b/gi,
];

const ROLE_TERMS = new Set([
  'ceo','cto','cfo','coo','vp','director','manager','lead','architect',
  'engineer','developer','analyst','designer','admin','founder','owner',
]);

// ── Tokenization ───────────────────────────────────────────
function tokenizeRaw(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function tokenize(text, options = {}) {
  let tokens = tokenizeRaw(text);
  if (options.negation !== false) tokens = applyNegation(tokens);
  if (options.stem !== false) tokens = tokens.map(t => t.startsWith('NOT_') ? 'NOT_' + porterStem(t.slice(4)) : porterStem(t));
  return tokens;
}

// ── BPE Token Counting (exact via gpt-tokenizer) ──────────
function countBpeTokens(text) {
  if (encode) {
    try { return encode(text).length; } catch { /* fallback */ }
  }
  // Fallback: word count * 1.3
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

// ── POS Tagging (via compromise) ──────────────────────────
function posTag(text) {
  if (!nlp) return null;
  const doc = nlp(text);
  const nouns = doc.nouns().out('array');
  const verbs = doc.verbs().out('array');
  const adjectives = doc.adjectives().out('array');
  const adverbs = doc.adverbs().out('array');
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const organizations = doc.organizations().out('array');
  const total = text.split(/\s+/).length || 1;
  return {
    nouns: nouns.length,
    verbs: verbs.length,
    adjectives: adjectives.length,
    adverbs: adverbs.length,
    contentWordRatio: round((nouns.length + verbs.length + adjectives.length + adverbs.length) / total),
    entities: {
      people: people.slice(0, 10),
      places: places.slice(0, 10),
      organizations: organizations.slice(0, 10),
    },
    topNouns: nouns.slice(0, 15),
  };
}

// ── Topic Modeling (LDA) ──────────────────────────────────
function extractTopics(text, numTopics = 5, termsPerTopic = 8) {
  if (!lda) return null;
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  if (sentences.length < 3) return null;
  try {
    const topics = lda(sentences, numTopics, termsPerTopic);
    return topics.map((terms, i) => ({
      id: i,
      terms: terms.map(t => ({ term: t.term, probability: round(t.probability) })),
    })).filter(t => t.terms.length > 0);
  } catch { return null; }
}

function chunkTopicDistribution(chunks, numTopics = 5) {
  if (!lda) return null;
  const allSentences = chunks.flatMap(c => c.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [c]);
  if (allSentences.length < 5) return null;
  try {
    const topics = lda(allSentences, numTopics, 6);
    if (!topics || topics.length === 0) return null;
    // Build topic term sets
    const topicTermSets = topics.map(t => new Set(t.map(x => x.term)));
    // Score each chunk by overlap with each topic
    return chunks.map(chunk => {
      const words = new Set(tokenizeRaw(chunk));
      const dist = topicTermSets.map(ts => {
        let overlap = 0;
        for (const term of ts) { if (words.has(term)) overlap++; }
        return round(overlap / (ts.size || 1));
      });
      const dominant = dist.indexOf(Math.max(...dist));
      return { distribution: dist, dominantTopic: dominant };
    });
  } catch { return null; }
}

// ── Chunking ───────────────────────────────────────────────
function chunkText(text, chunkSize = 500) {
  if (!text || text.length === 0) return [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

// ── TF-IDF Domain Term Extraction ──────────────────────────
function computeTermStats(chunks) {
  const N = chunks.length;
  if (N === 0) return { terms: {}, idf: {}, chunkTokenLists: [] };

  const df = {};
  const globalTf = {};
  const chunkTokenLists = chunks.map(chunk => {
    const tokens = tokenize(chunk);
    const unique = new Set(tokens);
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
    tokens.forEach(t => { globalTf[t] = (globalTf[t] || 0) + 1; });
    return tokens;
  });

  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (count + 1)) + 1; // smoothed IDF
  }

  // Domain terms: top terms by TF * IDF
  const termScores = {};
  for (const [term, tf] of Object.entries(globalTf)) {
    termScores[term] = tf * (idf[term] || 1);
  }

  // Sort and take top terms
  const sorted = Object.entries(termScores).sort((a, b) => b[1] - a[1]);
  const topN = Math.min(Math.max(30, Math.floor(sorted.length * 0.1)), 200);
  const terms = {};
  for (let i = 0; i < topN && i < sorted.length; i++) {
    terms[sorted[i][0]] = sorted[i][1];
  }

  return { terms, idf, chunkTokenLists };
}

// ── Scoring ────────────────────────────────────────────────
function scoreDomainAlignment(chunkTokens, domainTerms) {
  if (chunkTokens.length === 0) return 0;
  let matchWeight = 0;
  let maxWeight = 0;
  const termKeys = Object.keys(domainTerms);
  if (termKeys.length === 0) return 0;

  const maxTermScore = Math.max(...Object.values(domainTerms));

  for (const token of chunkTokens) {
    if (domainTerms[token]) {
      matchWeight += domainTerms[token] / maxTermScore;
    }
  }
  return Math.min(1, matchWeight / chunkTokens.length * 3); // scale factor
}

function scoreUserAlignment(chunkText) {
  if (!chunkText || chunkText.length === 0) return 0;

  let signals = 0;
  const words = chunkText.split(/\s+/).length;
  if (words === 0) return 0;

  // Pattern matches
  for (const pattern of USER_PATTERNS) {
    const matches = chunkText.match(pattern);
    if (matches) signals += matches.length;
  }

  // Role term matches
  const lowerTokens = tokenize(chunkText);
  for (const token of lowerTokens) {
    if (ROLE_TERMS.has(token)) signals += 2;
  }

  // Named entities heuristic: capitalized words mid-sentence
  const namedEntities = chunkText.match(/(?<=[a-z]\s)[A-Z][a-z]{2,}/g);
  if (namedEntities) signals += namedEntities.length * 0.5;

  return Math.min(1, signals / words * 5); // scale factor
}

// ── Statistics ─────────────────────────────────────────────
function computeStats(scores) {
  const n = scores.length;
  if (n === 0) return { mean: 0, stdDev: 0, skewness: 0, kurtosis: 0, min: 0, max: 0, median: 0, histogram: [] };

  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Skewness
  const m3 = scores.reduce((sum, s) => sum + ((s - mean) / (stdDev || 1)) ** 3, 0) / n;

  // Excess kurtosis
  const m4 = scores.reduce((sum, s) => sum + ((s - mean) / (stdDev || 1)) ** 4, 0) / n - 3;

  // Median
  const sorted = [...scores].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Histogram (20 bins from 0 to 1)
  const binCount = 20;
  const histogram = Array(binCount).fill(0);
  for (const s of scores) {
    const bin = Math.min(binCount - 1, Math.floor(s * binCount));
    histogram[bin]++;
  }
  // Normalize to density
  const binWidth = 1 / binCount;
  const histDensity = histogram.map(c => c / (n * binWidth));

  // Gaussian PDF for fitted curve
  const gaussianPdf = [];
  for (let i = 0; i < binCount; i++) {
    const x = (i + 0.5) / binCount;
    if (stdDev > 0) {
      const z = (x - mean) / stdDev;
      gaussianPdf.push((1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z));
    } else {
      gaussianPdf.push(x === Math.round(mean * binCount) / binCount ? n : 0);
    }
  }

  return {
    mean: round(mean),
    stdDev: round(stdDev),
    variance: round(variance),
    skewness: round(m3),
    kurtosis: round(m4),
    min: round(Math.min(...scores)),
    max: round(Math.max(...scores)),
    median: round(median),
    count: n,
    histogram: histDensity.map(round),
    gaussianFit: gaussianPdf.map(round),
    binEdges: Array.from({ length: binCount }, (_, i) => round(i / binCount)),
  };
}

function round(v, d = 4) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

// ── Main Analysis ──────────────────────────────────────────
/**
 * Extract frozen domain terms from a reference text.
 * Use with analyzeContext({ fixedDomainTerms }) to score all subsequent
 * contexts against a fixed reference — essential for measuring domain
 * drift and context rot.
 */
function extractDomainTerms(referenceText, options = {}) {
  const chunkSize = options.chunkSize || 500;
  const chunks = chunkText(referenceText, chunkSize);
  const { terms } = computeTermStats(chunks);
  return terms;
}

function analyzeContext(text, options = {}) {
  const chunkSize = options.chunkSize || 500;
  const chunks = chunkText(text, chunkSize);

  // If fixedDomainTerms provided, use those instead of deriving from this text
  let domainTerms, chunkTokenLists;
  if (options.fixedDomainTerms) {
    domainTerms = options.fixedDomainTerms;
    chunkTokenLists = chunks.map(c => tokenize(c));
  } else {
    const stats = computeTermStats(chunks);
    domainTerms = stats.terms;
    chunkTokenLists = stats.chunkTokenLists;
  }

  const domainScores = [];
  const userScores = [];
  const chunkDetails = [];

  for (let i = 0; i < chunks.length; i++) {
    const dScore = scoreDomainAlignment(chunkTokenLists[i], domainTerms);
    const uScore = scoreUserAlignment(chunks[i]);
    domainScores.push(dScore);
    userScores.push(uScore);

    chunkDetails.push({
      index: i,
      text: chunks[i],
      length: chunks[i].length,
      tokenCount: chunkTokenLists[i].length,
      domainScore: round(dScore),
      userScore: round(uScore),
    });
  }

  const domainStats = computeStats(domainScores);
  const userStats = computeStats(userScores);

  // Top domain terms for display
  const topDomainTerms = Object.entries(domainTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, weight]) => ({ term, weight: round(weight) }));

  return {
    summary: {
      totalLength: text.length,
      chunkCount: chunks.length,
      chunkSize,
      topDomainTerms,
    },
    domain: {
      stats: domainStats,
      interpretation: interpretBell(domainStats, 'domain'),
    },
    user: {
      stats: userStats,
      interpretation: interpretBell(userStats, 'user'),
    },
    chunks: chunkDetails,
  };
}

function interpretBell(stats, type) {
  const { mean, stdDev } = stats;
  const label = type === 'domain' ? 'domain-aligned' : 'user-specific';
  let alignment, spread;

  if (stdDev < 0.08) spread = 'very tight';
  else if (stdDev < 0.15) spread = 'tight';
  else if (stdDev < 0.25) spread = 'moderate';
  else spread = 'wide (flat)';

  if (mean > 0.6) alignment = 'strong';
  else if (mean > 0.35) alignment = 'moderate';
  else if (mean > 0.15) alignment = 'weak';
  else alignment = 'minimal';

  return {
    spread,
    alignment,
    narrative: `${spread} bell curve (σ=${stdDev}): ${alignment} ${label} content. `
      + (stdDev < 0.15 && mean > 0.4
        ? `Content is consistently ${label}.`
        : stdDev > 0.2
        ? `Content varies significantly in ${type} alignment.`
        : `Content shows some ${type} focus but not consistently.`),
  };
}

// ════════════════════════════��═════════════════════════════
// EXTENDED ANALYSIS — features matching standard NLP engines
// ══════════════════════════════════════════════════════════

// ── Readability Scores ─────────────────────────────────────
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

function readabilityScores(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const words = text.match(/\b[a-zA-Z]+\b/g) || [];
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const chars = words.join('').length;
  const W = words.length || 1;
  const S = sentences.length || 1;

  // Flesch-Kincaid Grade Level
  const fkGrade = 0.39 * (W / S) + 11.8 * (syllables / W) - 15.59;
  // Flesch Reading Ease
  const fkEase = 206.835 - 1.015 * (W / S) - 84.6 * (syllables / W);
  // Coleman-Liau Index
  const L = (chars / W) * 100;
  const Sv = (S / W) * 100;
  const cli = 0.0588 * L - 0.296 * Sv - 15.8;
  // Automated Readability Index
  const ari = 4.71 * (chars / W) + 0.5 * (W / S) - 21.43;

  return {
    fleschKincaidGrade: round(fkGrade),
    fleschReadingEase: round(fkEase),
    colemanLiau: round(cli),
    automatedReadabilityIndex: round(ari),
    avgSentenceLength: round(W / S),
    avgSyllablesPerWord: round(syllables / W),
    sentenceCount: S,
    wordCount: W,
  };
}

// ── Lexical Diversity ──────────────────────────────────────
function lexicalDiversity(tokens) {
  if (tokens.length === 0) return { typeTokenRatio: 0, hapaxRatio: 0, uniqueTokens: 0 };
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  const types = Object.keys(freq).length;
  const hapax = Object.values(freq).filter(c => c === 1).length;
  return {
    typeTokenRatio: round(types / tokens.length),
    hapaxRatio: round(hapax / types || 0),
    uniqueTokens: types,
    totalTokens: tokens.length,
  };
}

// ── Sentiment (basic lexicon-based) ────────────────────────
const POS_WORDS = new Set(['good','great','excellent','best','better','improve','improved','success','successful','effective','efficient','fast','reliable','secure','safe','clean','clear','easy','simple','perfect','optimal','correct','accurate','robust','powerful','strong','innovative']);
const NEG_WORDS = new Set(['bad','worst','worse','fail','failed','failure','error','errors','wrong','broken','slow','expensive','complex','complicated','difficult','hard','insecure','unsafe','unreliable','fragile','buggy','degraded','corrupt','corrupted','missing','lost','silent','misroute']);

function sentimentAnalysis(text) {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  let pos = 0, neg = 0;
  words.forEach(w => {
    if (POS_WORDS.has(w)) pos++;
    if (NEG_WORDS.has(w)) neg++;
  });
  const total = pos + neg || 1;
  return {
    positive: pos,
    negative: neg,
    score: round((pos - neg) / (words.length || 1)), // -1 to 1
    ratio: round(pos / total),
    label: pos > neg * 1.5 ? 'positive' : neg > pos * 1.5 ? 'negative' : 'neutral',
  };
}

// ── N-gram Analysis ──────────────────────────────��─────────
function ngramAnalysis(tokens, n = 2, topK = 10) {
  if (tokens.length < n) return [];
  const grams = {};
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    grams[gram] = (grams[gram] || 0) + 1;
  }
  return Object.entries(grams)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([gram, count]) => ({ gram, count }));
}

// ── Entropy / Information Density ──────────────────────────
function shannonEntropy(tokens) {
  if (tokens.length === 0) return 0;
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  const n = tokens.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return round(entropy);
}

// ── Cosine Similarity between chunks ───────────────────────
function cosineSimilarity(tokensA, tokensB) {
  const freqA = {}, freqB = {};
  tokensA.forEach(t => { freqA[t] = (freqA[t] || 0) + 1; });
  tokensB.forEach(t => { freqB[t] = (freqB[t] || 0) + 1; });
  const allTerms = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  let dot = 0, magA = 0, magB = 0;
  for (const t of allTerms) {
    const a = freqA[t] || 0;
    const b = freqB[t] || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  return (magA && magB) ? round(dot / (Math.sqrt(magA) * Math.sqrt(magB))) : 0;
}

function chunkSimilarityMatrix(chunkTokenLists) {
  const n = chunkTokenLists.length;
  const avgSimilarity = [];
  let totalSim = 0, count = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const sim = cosineSimilarity(chunkTokenLists[i], chunkTokenLists[j]);
        rowSum += sim;
        totalSim += sim;
        count++;
      }
    }
    avgSimilarity.push(round(n > 1 ? rowSum / (n - 1) : 0));
  }
  return {
    perChunkAvg: avgSimilarity,
    globalAvg: round(count > 0 ? totalSim / count : 0),
  };
}

// ── Percentiles ──────────────────────────────────��─────────
function percentiles(scores, ps = [10, 25, 50, 75, 90]) {
  if (scores.length === 0) return {};
  const sorted = [...scores].sort((a, b) => a - b);
  const result = {};
  for (const p of ps) {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    result['p' + p] = round(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
  }
  return result;
}

// ── Token estimation (LLM-style) ──────────────────────────
function estimateTokens(text) {
  return countBpeTokens(text);
}

// ── Sentence length distribution ──────────────────────────
function sentenceLengthStats(text) {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [];
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  if (lengths.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
  const stats = computeStats(lengths.map(l => l / Math.max(...lengths))); // normalize for reuse
  return {
    mean: round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    stdDev: round(Math.sqrt(lengths.reduce((s, l) => s + (l - lengths.reduce((a, b) => a + b, 0) / lengths.length) ** 2, 0) / lengths.length)),
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    count: lengths.length,
  };
}

// ── Correlation ────────────────────────────────────────────
function sampleCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] - mx, y = ys[i] - my;
    num += x * y; dx += x * x; dy += y * y;
  }
  return (dx && dy) ? round(num / Math.sqrt(dx * dy)) : 0;
}

// ── Linear Regression (trend detection) ───────────────────
function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, trend: 'flat' };
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (ys[i] - my); den += (i - mx) ** 2; }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  // R²
  const predicted = xs.map(x => intercept + slope * x);
  const ssRes = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const trend = Math.abs(slope) < 0.001 ? 'flat' : slope > 0 ? 'increasing' : 'decreasing';
  return { slope: round(slope), intercept: round(intercept), rSquared: round(rSquared), trend };
}

// ── IQR and MAD (robust spread measures) ──────────────────
function robustSpread(scores) {
  if (scores.length === 0) return { iqr: 0, mad: 0, q1: 0, q3: 0 };
  const sorted = [...scores].sort((a, b) => a - b);
  const q = (p) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    return lo === Math.ceil(idx) ? sorted[lo] : sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (idx - lo);
  };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const median = q(0.5);
  const deviations = scores.map(s => Math.abs(s - median)).sort((a, b) => a - b);
  const mad = deviations.length % 2 === 0
    ? (deviations[deviations.length / 2 - 1] + deviations[deviations.length / 2]) / 2
    : deviations[Math.floor(deviations.length / 2)];
  return { iqr: round(iqr), mad: round(mad), q1: round(q1), q3: round(q3) };
}

// ── Z-Scores per chunk ────────────────────────────────────
function zScores(scores) {
  if (scores.length === 0) return [];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length) || 1;
  return scores.map(s => round((s - mean) / std));
}

// ── Moving Average ────────────────────────────────────────
function movingAverage(values, window = 5) {
  if (values.length <= window) return values.map(round);
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(values.length, start + window);
    const slice = values.slice(start, end);
    result.push(round(slice.reduce((a, b) => a + b, 0) / slice.length));
  }
  return result;
}

// ── Reading Time ──────────────────────────────────────────
function readingTime(text, wpm = 250) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = words / wpm;
  return { minutes: round(minutes), seconds: Math.round(minutes * 60), words };
}

// ── Extended analyzeContext ────────────────────────────────
function analyzeContextExtended(text, options = {}) {
  const base = analyzeContext(text, options);
  const allTokens = tokenize(text);
  const chunkTokenLists = base.chunks.map(c => tokenize(c.text));

  // Add extended metrics
  base.readability = readabilityScores(text);
  base.lexical = lexicalDiversity(allTokens);
  base.sentiment = sentimentAnalysis(text);
  base.entropy = shannonEntropy(allTokens);
  base.bigrams = ngramAnalysis(allTokens, 2, 10);
  base.trigrams = ngramAnalysis(allTokens, 3, 10);
  base.estimatedTokens = estimateTokens(text);
  base.sentenceStats = sentenceLengthStats(text);
  base.chunkSimilarity = chunkSimilarityMatrix(chunkTokenLists);

  // Alignment score arrays
  const domainScores = base.chunks.map(c => c.domainScore);
  const userScores = base.chunks.map(c => c.userScore);

  // Percentiles for alignment scores
  base.domain.percentiles = percentiles(domainScores);
  base.user.percentiles = percentiles(userScores);

  // Robust spread measures
  base.domain.robustSpread = robustSpread(domainScores);
  base.user.robustSpread = robustSpread(userScores);

  // Trend detection (does alignment increase/decrease through the document?)
  base.domain.trend = linearRegression(domainScores);
  base.user.trend = linearRegression(userScores);

  // Correlation between domain and user alignment
  base.domainUserCorrelation = sampleCorrelation(domainScores, userScores);

  // Moving averages (5-chunk window)
  base.domain.movingAvg = movingAverage(domainScores, 5);
  base.user.movingAvg = movingAverage(userScores, 5);

  // Reading time
  base.readingTime = readingTime(text);

  // BPE token count (exact if gpt-tokenizer available)
  base.bpeTokenCount = countBpeTokens(text);
  base.tokenMethod = encode ? 'bpe-exact' : 'word-estimate';

  // POS tagging + NER (if compromise available)
  base.pos = posTag(text);

  // Topic modeling (if lda available)
  base.topics = extractTopics(text);
  const topicDist = chunkTopicDistribution(base.chunks.map(c => c.text));

  // Z-scores for outlier detection
  const domainZ = zScores(domainScores);
  const userZ = zScores(userScores);

  // Per-chunk extended data
  for (let i = 0; i < base.chunks.length; i++) {
    base.chunks[i].sentiment = sentimentAnalysis(base.chunks[i].text).score;
    base.chunks[i].entropy = shannonEntropy(chunkTokenLists[i]);
    base.chunks[i].lexicalDiversity = lexicalDiversity(chunkTokenLists[i]).typeTokenRatio;
    base.chunks[i].avgSimilarityToOthers = base.chunkSimilarity.perChunkAvg[i];
    base.chunks[i].domainZScore = domainZ[i];
    base.chunks[i].userZScore = userZ[i];
    base.chunks[i].bpeTokens = countBpeTokens(base.chunks[i].text);
    if (topicDist && topicDist[i]) {
      base.chunks[i].topicDistribution = topicDist[i].distribution;
      base.chunks[i].dominantTopic = topicDist[i].dominantTopic;
    }
  }

  return base;
}

module.exports = {
  analyzeContext, analyzeContextExtended, extractDomainTerms, chunkText, computeStats, tokenize,
  readabilityScores, lexicalDiversity, sentimentAnalysis, ngramAnalysis,
  shannonEntropy, cosineSimilarity, chunkSimilarityMatrix, percentiles,
  estimateTokens, sentenceLengthStats,
  sampleCorrelation, linearRegression, robustSpread, zScores,
  movingAverage, readingTime, porterStem, applyNegation,
  countBpeTokens, posTag, extractTopics, chunkTopicDistribution,
};
