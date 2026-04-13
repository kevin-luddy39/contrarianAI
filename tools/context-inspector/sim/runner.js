/**
 * Batch simulation runner.
 *
 * Usage:
 *   node runner.js                            # Run all 150 sims (50 per scenario)
 *   node runner.js --scenario rag-pipeline    # Run 50 for one scenario
 *   node runner.js --count 10                 # Override count
 *   node runner.js --seed-base 2000           # Custom seed base
 */

const { createRng } = require('./seed-rng');
const { getDb, save } = require('./db');
const { runSimulation } = require('./engine');
const { RagPipeline } = require('./scenarios/rag-pipeline');
const { MultiAgent } = require('./scenarios/multi-agent');
const { SupportBot } = require('./scenarios/support-bot');
const crypto = require('crypto');

const SCENARIO_MAP = {
  'rag-pipeline': RagPipeline,
  'multi-agent': MultiAgent,
  'support-bot': SupportBot,
};

function parseArgs(argv) {
  const args = { scenario: null, count: 50, seedBase: 1000 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--scenario' && argv[i + 1]) args.scenario = argv[++i];
    else if (argv[i] === '--count' && argv[i + 1]) args.count = parseInt(argv[++i]);
    else if (argv[i] === '--seed-base' && argv[i + 1]) args.seedBase = parseInt(argv[++i]);
  }
  return args;
}

async function runBatch(scenarioName, count, seedBase, onProgress) {
  const ScenarioClass = SCENARIO_MAP[scenarioName];
  if (!ScenarioClass) throw new Error(`Unknown scenario: ${scenarioName}`);

  const results = [];

  for (let i = 0; i < count; i++) {
    const seed = seedBase + i;
    const rng = createRng(seed);
    const scenario = new ScenarioClass(rng);
    const runId = crypto.randomUUID();

    const result = await runSimulation(scenario, runId, { seed, chunkSize: 500 });
    results.push(result);

    if (onProgress) {
      onProgress({
        scenario: scenarioName,
        completed: i + 1,
        total: count,
        lastRun: result,
      });
    }
  }

  // Aggregate stats
  const domainMeans = results.map(r => r.finalDomain?.mean || 0);
  const domainStds = results.map(r => r.finalDomain?.stdDev || 0);
  const userMeans = results.map(r => r.finalUser?.mean || 0);

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = arr => {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };

  return {
    scenario: scenarioName,
    runCount: count,
    seedBase,
    aggregate: {
      domainMean: { avg: avg(domainMeans).toFixed(4), std: std(domainMeans).toFixed(4) },
      domainStd: { avg: avg(domainStds).toFixed(4), std: std(domainStds).toFixed(4) },
      userMean: { avg: avg(userMeans).toFixed(4), std: std(userMeans).toFixed(4) },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  await getDb();

  const scenarios = args.scenario ? [args.scenario] : Object.keys(SCENARIO_MAP);

  console.log(`\nContext Inspector — Simulation Batch Runner`);
  console.log(`Scenarios: ${scenarios.join(', ')}`);
  console.log(`Runs per scenario: ${args.count}`);
  console.log(`Seed base: ${args.seedBase}\n`);

  for (const name of scenarios) {
    console.log(`  Running ${name}...`);
    const start = Date.now();

    const result = await runBatch(name, args.count, args.seedBase, (progress) => {
      process.stdout.write(`\r    ${progress.completed}/${progress.total} complete`);
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\r    ${result.runCount} runs in ${elapsed}s`);
    console.log(`    Domain: mean=${result.aggregate.domainMean.avg} (±${result.aggregate.domainMean.std}), σ=${result.aggregate.domainStd.avg}`);
    console.log(`    User:   mean=${result.aggregate.userMean.avg}\n`);
  }

  save();
  console.log('Done. Results saved to sim.db');
}

if (require.main === module) main().catch(console.error);

module.exports = { runBatch, SCENARIO_MAP };
