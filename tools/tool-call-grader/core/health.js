/**
 * Aggregate tool-call session health score.
 *
 * Primary signal: success rate. Secondary signals: mean relevance,
 * structured-response rate, tool diversity. Bounded penalties from
 * each secondary signal keep one noisy indicator from tanking the score.
 */

const DEFAULT_TOLERANCE = {
  successRate:     0.80,    // floor — below this, primary score degrades
  meanRelevance:   0.35,    // secondary
  structuredRate:  0.70,    // secondary
  toolDiversity:   0.30,    // secondary (1 − Herfindahl)
};

const PENALTY_WEIGHT = 0.15;

function scoreFromSignals(signals, tolerance = DEFAULT_TOLERANCE) {
  const primary = signals.successRate != null
    ? clip(signals.successRate / tolerance.successRate)
    : 1;

  let penalty = 0;
  if (signals.meanRelevance != null && signals.meanRelevance < tolerance.meanRelevance) {
    penalty += PENALTY_WEIGHT * clip(
      (tolerance.meanRelevance - signals.meanRelevance) / tolerance.meanRelevance
    );
  }
  if (signals.structuredRate != null && signals.structuredRate < tolerance.structuredRate) {
    penalty += PENALTY_WEIGHT * clip(
      (tolerance.structuredRate - signals.structuredRate) / tolerance.structuredRate
    );
  }
  if (signals.toolDiversity != null && signals.toolDiversity < tolerance.toolDiversity) {
    penalty += PENALTY_WEIGHT * clip(
      (tolerance.toolDiversity - signals.toolDiversity) / tolerance.toolDiversity
    );
  }
  return Math.max(0, primary - penalty);
}

function regime(score) {
  if (score >= 0.82) return 'healthy';
  if (score >= 0.60) return 'drift';
  if (score >= 0.30) return 'contamination';
  return 'rot';
}

function clip(v) { return Math.max(0, Math.min(1, v)); }

module.exports = { scoreFromSignals, regime, DEFAULT_TOLERANCE };
