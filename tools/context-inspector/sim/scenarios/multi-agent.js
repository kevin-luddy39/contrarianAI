const { BaseScenario } = require('./base');
const { COORDINATOR, RESEARCHER, CODER, REVIEWER, TOPICS, PRIORITIES, COMPLEXITIES, VERDICTS } = require('../content/agent-templates');

class MultiAgent extends BaseScenario {
  constructor(rng) {
    super(rng, {
      name: 'multi-agent',
      maxTurns: 50,
      failureProbabilities: {
        coordination_bloat: (turn) => turn > 15 ? 0.3 : 0.05,
        tool_misroute: 0.1,
        self_eval: (turn) => turn > 20 ? 0.25 : 0,
      },
    });
    this.agents = ['researcher', 'coder', 'reviewer'];
    this.currentTask = '';
    this.cycle = 0;
    this.phaseInCycle = 0; // 0=dispatch, 1=work, 2=report, 3=synthesize
  }

  fillTemplate(template, vars = {}) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || this.rng.pick(TOPICS));
  }

  init() {
    super.init();
    this.currentTask = this.rng.pick(TOPICS);
    this.appendToContext(`[SYSTEM] Multi-agent orchestration initialized. Task: "${this.currentTask}". Agents: coordinator, researcher, coder, reviewer.`);
  }

  nextTurn() {
    this.turn++;
    if (this.turn > this.maxTurns) { this.done = true; return null; }

    let text, eventType, eventLabel, failurePattern = null;
    const phase = this.phaseInCycle % 4;
    this.phaseInCycle++;

    switch (phase) {
      case 0: { // Coordinator dispatch
        if (this.cycle > 0) {
          this.currentTask = this.rng.pick(TOPICS);
        }
        const agent = this.rng.pick(this.agents);
        const shouldBloat = this.shouldInjectFailure('coordination_bloat');

        if (shouldBloat) {
          const tmpl = this.rng.pick(COORDINATOR.overhead);
          text = this.fillTemplate(tmpl, {
            original: this.currentTask,
            previous: 'analysis of ' + this.rng.pick(TOPICS) + ', implementation of ' + this.rng.pick(TOPICS),
            status: 'in progress',
            next: 'agent dispatch for ' + this.currentTask,
            iter: String(this.cycle + 1),
            tokens: String(this.tokenCount),
            budget: String(Math.max(0, 100000 - this.tokenCount)),
          });
          failurePattern = 'coordination_bloat';
          eventLabel = 'Coordinator (BLOAT)';
        } else {
          const tmpl = this.rng.pick(COORDINATOR.dispatch);
          text = this.fillTemplate(tmpl, {
            task: this.currentTask,
            agent,
            priority: this.rng.pick(PRIORITIES),
            summary: `Previous cycle analyzed ${this.rng.pick(TOPICS)}`,
          });
          eventLabel = `Coordinator → ${agent}`;
        }
        eventType = 'coordinator';
        break;
      }
      case 1: { // Agent work
        const shouldMisroute = this.shouldInjectFailure('tool_misroute');
        let agent, templates;

        if (shouldMisroute) {
          // Wrong agent gets the task
          agent = this.rng.pick(['coder', 'reviewer']);
          templates = agent === 'coder' ? CODER : REVIEWER;
          failurePattern = 'tool_misroute';
          eventLabel = `${agent} (MISROUTED)`;
        } else {
          agent = this.rng.pick(this.agents);
          templates = agent === 'researcher' ? RESEARCHER : agent === 'coder' ? CODER : REVIEWER;
          eventLabel = `${agent} working`;
        }

        const workTemplates = templates.work;
        const doToolCall = this.rng.chance(0.4) && templates.toolCall;

        text = this.fillTemplate(this.rng.pick(workTemplates), {
          topic: this.currentTask,
          feature: this.currentTask,
          component: 'core module',
          findings: 'three significant patterns detected in the data',
          sources: this.rng.randomInt(3, 8) + ' documents',
          confidence: this.rng.pick(['high', 'medium', 'low']),
          count: String(this.rng.randomInt(2, 12)),
          insight: 'the primary bottleneck is in the data transformation layer',
          related: this.rng.pick(TOPICS),
          approach: this.rng.pick(['microservice pattern', 'event-driven architecture', 'pipeline pattern']),
          complexity: this.rng.pick(COMPLEXITIES),
          function_name: 'process_' + this.currentTask.replace(/\s+/g, '_').slice(0, 20),
          params: 'data, config',
          docstring: 'Process ' + this.currentTask,
          implementation: '    result = transform(data, config)',
          return_val: 'result',
          issue: 'performance bottleneck',
          files: String(this.rng.randomInt(2, 8)),
          tests: String(this.rng.randomInt(3, 15)),
          description: 'optimized hot path',
          framework: this.rng.pick(['FastAPI', 'Express', 'Flask']),
          pattern: this.rng.pick(['repository', 'service', 'factory']),
          integrations: this.rng.pick(TOPICS),
        });

        if (doToolCall) {
          text += '\n' + this.fillTemplate(this.rng.pick(templates.toolCall), {
            query: this.currentTask,
            dataset: 'production_metrics',
            suite: 'integration',
            path: 'src/',
            count: String(this.rng.randomInt(3, 20)),
            title: this.currentTask + ' implementation guide',
            score: this.rng.randomFloat(0.6, 0.99).toFixed(2),
            rows: String(this.rng.randomInt(1000, 50000)),
            mean: this.rng.randomFloat(0.1, 0.9).toFixed(3),
            std: this.rng.randomFloat(0.01, 0.3).toFixed(3),
            p95: this.rng.randomFloat(0.5, 2.0).toFixed(3),
            passed: String(this.rng.randomInt(40, 60)),
            total: '60',
            failed: String(this.rng.randomInt(0, 5)),
            module: 'integration',
            error: 'timeout on external service call',
            warnings: String(this.rng.randomInt(0, 12)),
            errors: String(this.rng.randomInt(0, 3)),
            issue: 'unused imports',
          });
        }
        eventType = 'agent_work';
        break;
      }
      case 2: { // Agent report
        const shouldSelfEval = this.shouldInjectFailure('self_eval');
        if (shouldSelfEval) {
          const tmpl = this.rng.pick(REVIEWER.selfEval);
          text = this.fillTemplate(tmpl, {
            agent: this.rng.pick(this.agents),
            score: String(this.rng.randomInt(6, 9)),
            confidence: String(this.rng.randomInt(70, 95)),
          });
          failurePattern = 'self_eval';
          eventLabel = 'Reviewer SELF-EVAL';
        } else {
          const tmpl = this.rng.pick(REVIEWER.work);
          text = this.fillTemplate(tmpl, {
            agent: this.rng.pick(this.agents),
            assessment: this.rng.pick(['solid work', 'needs minor adjustments', 'meets requirements', 'exceeds expectations']),
            score: String(this.rng.randomInt(5, 10)),
            issues: this.rng.randomInt(0, 4) + ' minor issues',
            deliverable: this.currentTask + ' implementation',
            correct: String(this.rng.randomInt(3, 5)),
            complete: String(this.rng.randomInt(3, 5)),
            efficient: String(this.rng.randomInt(3, 5)),
            verdict: this.rng.pick(VERDICTS),
            count: String(this.rng.randomInt(1, 5)),
            suggestions: 'add error handling, improve variable naming',
          });
          eventLabel = 'Review';
        }
        eventType = 'review';
        break;
      }
      case 3: { // Coordinator synthesize
        const tmpl = this.rng.pick(COORDINATOR.synthesize);
        text = this.fillTemplate(tmpl, {
          findings: 'analysis complete with ' + this.rng.randomInt(3, 8) + ' action items',
          agent1: 'researcher',
          agent2: 'coder',
          finding1: this.rng.pick(TOPICS) + ' requires attention',
          finding2: 'implementation ready for deployment',
          count: String(this.rng.randomInt(2, 4)),
        });
        eventType = 'synthesize';
        eventLabel = 'Coordinator synthesize';
        this.cycle++;
        break;
      }
    }

    this.appendToContext(text);
    return { text, eventType, eventLabel, failurePattern };
  }
}

module.exports = { MultiAgent };
