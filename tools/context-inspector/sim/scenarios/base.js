/**
 * Base scenario — shared state machine infrastructure.
 */

class BaseScenario {
  constructor(rng, config = {}) {
    this.rng = rng;
    this.name = config.name || 'base';
    this.maxTurns = config.maxTurns || 50;
    this.turn = 0;
    this.context = '';
    this.state = 'init';
    this.done = false;
    this.failureProbabilities = config.failureProbabilities || {};
  }

  /** Estimate token count from text */
  estimateTokens(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  get tokenCount() {
    return this.estimateTokens(this.context);
  }

  /** Append text to the running context */
  appendToContext(text) {
    this.context += (this.context ? '\n\n' : '') + text;
  }

  /** Check if a failure pattern should be injected this turn */
  shouldInjectFailure(pattern) {
    const prob = this.failureProbabilities[pattern];
    if (!prob) return false;
    // Probability can be a number or a function(turn, maxTurns) => number
    const p = typeof prob === 'function' ? prob(this.turn, this.maxTurns) : prob;
    return this.rng.chance(p);
  }

  /** Override in subclass: produce the next turn */
  nextTurn() {
    throw new Error('Subclass must implement nextTurn()');
  }

  /** Initialize scenario state */
  init() {
    this.state = 'init';
    this.turn = 0;
    this.context = '';
    this.done = false;
  }
}

module.exports = { BaseScenario };
