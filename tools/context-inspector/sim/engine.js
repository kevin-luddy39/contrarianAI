/**
 * Simulation engine — runs a scenario step-by-step,
 * feeds context into the analysis engine, stores results.
 */

const { analyzeContext } = require('../core');
const { insertStep, insertRun, completeRun, save } = require('./db');

async function runSimulation(scenario, runId, options = {}) {
  const { chunkSize = 500, onStep = null } = options;

  scenario.init();

  insertRun({
    id: runId,
    scenario: scenario.name,
    seed: options.seed || 0,
    params: { chunkSize, maxTurns: scenario.maxTurns },
  });

  let lastDomainStats = null;
  let lastUserStats = null;

  while (!scenario.done) {
    const result = scenario.nextTurn();
    if (!result) break;

    // Analyze the accumulated context
    const analysis = analyzeContext(scenario.context, { chunkSize });

    const stepData = {
      runId,
      turn: scenario.turn,
      tokenCount: scenario.tokenCount,
      eventType: result.eventType,
      eventLabel: result.eventLabel,
      contextLength: scenario.context.length,
      domain: analysis.domain.stats,
      user: analysis.user.stats,
      chunkCount: analysis.summary.chunkCount,
      failurePattern: result.failurePattern,
    };

    insertStep(stepData);

    lastDomainStats = analysis.domain.stats;
    lastUserStats = analysis.user.stats;

    // Emit for live viewing
    if (onStep) {
      onStep({
        ...stepData,
        domainInterpretation: analysis.domain.interpretation,
        userInterpretation: analysis.user.interpretation,
      });
    }
  }

  // Finalize run
  completeRun(runId, {
    totalTurns: scenario.turn,
    domainMean: lastDomainStats?.mean || 0,
    domainStd: lastDomainStats?.stdDev || 0,
    userMean: lastUserStats?.mean || 0,
    userStd: lastUserStats?.stdDev || 0,
  });

  save();

  return {
    id: runId,
    scenario: scenario.name,
    turns: scenario.turn,
    finalDomain: lastDomainStats,
    finalUser: lastUserStats,
  };
}

module.exports = { runSimulation };
