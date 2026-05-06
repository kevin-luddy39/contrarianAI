// GitHub issues pain-content scraper. Searches for issues on popular
// AI/RAG/agent libraries with pain-shaped phrases in title or body.
// GH search API requires authenticated requests via gh CLI for higher
// rate limit (5000/hr authed vs 60/hr unauthed).

const { execSync } = require('child_process');

const PAIN_QUERIES = [
  'is:issue "can\'t figure out why" in:body',
  'is:issue "silently fails" in:body',
  'is:issue "hallucinating" in:body',
  'is:issue "wrong tool call" in:body',
  'is:issue "rag fails" in:body',
  'is:issue "agent stuck" in:body',
  'is:issue "intermittent" agent in:body',
  'is:issue "regression" rag in:body',
  'is:issue "context window" degradation in:body',
];

// Limit search to popular AI/RAG repos so we get production-relevant pain,
// not spam from random repos
const REPOS = [
  'langchain-ai/langchain',
  'langchain-ai/langgraph',
  'run-llama/llama_index',
  'crewAIInc/crewAI',
  'microsoft/autogen',
  'openai/openai-python',
  'anthropics/anthropic-sdk-python',
  'modelcontextprotocol/servers',
  'pinecone-io/pinecone-python-client',
  'qdrant/qdrant-client',
  'chroma-core/chroma',
  'weaviate/weaviate-python-client',
];

function ghApiSearch(query) {
  try {
    const cmd = `gh api -H "Accept: application/vnd.github+json" "/search/issues?q=${encodeURIComponent(query)}&per_page=20"`;
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    return { items: [] };
  }
}

async function fetchPosts(opts = {}) {
  const { sinceDays = 30 } = opts;
  const cutoff = new Date(Date.now() - sinceDays * 86400 * 1000);
  const seen = new Set();
  const all = [];

  // Search across pain queries × repos. GH search is rate-limited so
  // batch one query per repo.
  for (const q of PAIN_QUERIES) {
    for (const repo of REPOS) {
      const fullQ = `${q} repo:${repo}`;
      const data = ghApiSearch(fullQ);
      for (const issue of (data.items || [])) {
        if (seen.has(issue.html_url)) continue;
        if (issue.created_at && new Date(issue.created_at) < cutoff) continue;
        seen.add(issue.html_url);
        all.push({
          source: 'github',
          id: `${repo}#${issue.number}`,
          repo,
          author: issue.user?.login,
          title: issue.title,
          text: (issue.body || '').slice(0, 4000),
          url: issue.html_url,
          ups: issue.reactions?.total_count || 0,
          num_comments: issue.comments,
          created_at: issue.created_at,
        });
      }
    }
  }
  return all;
}

module.exports = { fetchPosts, PAIN_QUERIES, REPOS };
