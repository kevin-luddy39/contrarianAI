const { BaseScenario } = require('./base');
const { DOMAINS, NOISE_DOCS } = require('../content/rag-corpus');

const DOMAIN_KEYS = Object.keys(DOMAINS);

const USER_QUERIES = {
  ml_ops: [
    'How do we set up model versioning for our deployment pipeline?',
    'What are best practices for GPU utilization monitoring?',
    'How should we handle model rollbacks in production?',
    'What metrics should we track for training-serving skew?',
  ],
  security: [
    'How do we protect our AI endpoints from prompt injection?',
    'What authentication patterns work best for inference APIs?',
    'How do we handle data privacy with model memorization risks?',
    'What should our AI supply chain security look like?',
  ],
  data_eng: [
    'How should we architect our streaming feature pipeline?',
    'What data quality framework works for ML pipelines?',
    'How do we implement column-level lineage tracking?',
    'What are the tradeoffs between Delta Lake and Iceberg?',
  ],
  product: [
    'How should we measure AI product success beyond accuracy?',
    'What interaction patterns build user trust in AI features?',
    'How do we implement progressive disclosure for AI?',
    'What feedback loop design captures the most user signal?',
  ],
};

class RagPipeline extends BaseScenario {
  constructor(rng) {
    super(rng, {
      name: 'rag-pipeline',
      maxTurns: 50,
      failureProbabilities: {
        context_rot: (turn) => turn > 25 ? 0.4 : 0.05,
        irrelevant_retrieval: (turn) => turn > 30 ? 0.5 : 0.1,
      },
    });
    this.primaryDomain = rng.pick(DOMAIN_KEYS);
    this.queryIndex = 0;
    this.states = ['user_query', 'retrieval', 'context_build', 'generation'];
    this.stateIndex = 0;
    this.currentQuery = '';
  }

  init() {
    super.init();
    this.appendToContext(`[SYSTEM] RAG Pipeline initialized. Primary domain: ${this.primaryDomain}. Knowledge base loaded with ${DOMAIN_KEYS.length} domains.`);
  }

  nextTurn() {
    this.turn++;
    if (this.turn > this.maxTurns) { this.done = true; return null; }

    const phase = this.states[this.stateIndex % this.states.length];
    this.stateIndex++;
    let text, eventType, eventLabel, failurePattern = null;

    switch (phase) {
      case 'user_query': {
        // Gradually drift to other domains
        const driftChance = this.turn / this.maxTurns * 0.6;
        const domain = this.rng.chance(driftChance)
          ? this.rng.pick(DOMAIN_KEYS.filter(d => d !== this.primaryDomain))
          : this.primaryDomain;
        const queries = USER_QUERIES[domain];
        this.currentQuery = this.rng.pick(queries);
        text = `[USER] ${this.currentQuery}`;
        eventType = 'user_msg';
        eventLabel = `User query (${domain})`;
        break;
      }
      case 'retrieval': {
        const shouldMisretrieve = this.shouldInjectFailure('irrelevant_retrieval');
        let docs;
        if (shouldMisretrieve) {
          // Retrieve noise instead of relevant docs
          docs = this.rng.pickN(NOISE_DOCS, this.rng.randomInt(1, 2));
          failurePattern = 'irrelevant_retrieval';
          eventLabel = 'Retrieval (NOISE injected)';
        } else {
          const domain = this.rng.pick(DOMAIN_KEYS);
          docs = this.rng.pickN(DOMAINS[domain], this.rng.randomInt(1, 3));
          eventLabel = `Retrieval (${domain})`;
        }
        text = `[RETRIEVAL] Retrieved ${docs.length} documents:\n${docs.map((d, i) => `  Doc ${i + 1}: ${d}`).join('\n')}`;
        eventType = 'retrieval';
        break;
      }
      case 'context_build': {
        const shouldRot = this.shouldInjectFailure('context_rot');
        if (shouldRot) {
          // Summarize with data loss
          text = `[CONTEXT] Summarizing accumulated context to manage window size. Key points retained: general discussion of system architecture and deployment patterns. [NOTE: specific numbers, order IDs, and threshold values lost in summarization]`;
          failurePattern = 'context_rot';
          eventLabel = 'Context build (ROT: data loss)';
        } else {
          text = `[CONTEXT] Building answer context from ${this.rng.randomInt(2, 5)} retrieved passages. Relevance scores: ${Array.from({length: 3}, () => this.rng.randomFloat(0.5, 0.99).toFixed(2)).join(', ')}.`;
          eventLabel = 'Context build';
        }
        eventType = 'context_build';
        break;
      }
      case 'generation': {
        text = `[ASSISTANT] Based on the retrieved documents, here is the answer to "${this.currentQuery.slice(0, 50)}...": The recommended approach involves ${this.rng.pick(['implementing a structured pipeline', 'establishing monitoring frameworks', 'deploying automated validation checks', 'configuring security policies'])} with ${this.rng.pick(['careful attention to edge cases', 'proper error handling at each stage', 'regular review cycles', 'automated rollback mechanisms'])}.`;
        eventType = 'generation';
        eventLabel = 'Response generation';
        break;
      }
    }

    this.appendToContext(text);
    return { text, eventType, eventLabel, failurePattern };
  }
}

module.exports = { RagPipeline };
