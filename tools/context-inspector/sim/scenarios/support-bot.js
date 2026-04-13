const { BaseScenario } = require('./base');
const { PRODUCTS, ISSUES, CUSTOMER_PERSONALITIES, BOT_RESPONSES, TANGENTS, INTEGRATIONS, ERRORS } = require('../content/support-scripts');

class SupportBot extends BaseScenario {
  constructor(rng) {
    super(rng, {
      name: 'support-bot',
      maxTurns: 50,
      failureProbabilities: {
        topic_drift: (turn) => turn > 15 ? 0.35 : 0.05,
        sentiment_escalation: (turn) => turn > 25 ? 0.4 : 0.1,
      },
    });
    this.product = rng.pick(PRODUCTS);
    this.personality = rng.pick(Object.keys(CUSTOMER_PERSONALITIES));
    this.persona = CUSTOMER_PERSONALITIES[this.personality];
    this.issueCategory = rng.pick(Object.keys(ISSUES));
    this.phase = 'greeting'; // greeting -> issue -> diagnosis -> resolution/escalation
    this.turnInPhase = 0;
    this.escalated = false;
    this.ticketNum = rng.randomInt(10000, 99999);
  }

  fillSlots(template) {
    return template
      .replace(/\{product\}/g, this.product)
      .replace(/\{order\}/g, String(this.rng.randomInt(100000, 999999)))
      .replace(/\{amount\}/g, String(this.rng.randomInt(50, 5000)))
      .replace(/\{quoted\}/g, String(this.rng.randomInt(50, 2000)))
      .replace(/\{account\}/g, String(this.rng.randomInt(1000, 9999)))
      .replace(/\{time\}/g, this.rng.pick(['30 minutes', '2 hours', 'yesterday', 'since Monday']))
      .replace(/\{date\}/g, this.rng.pick(['March 15', 'last Tuesday', '2 days ago', 'this morning']))
      .replace(/\{integration\}/g, this.rng.pick(INTEGRATIONS))
      .replace(/\{error\}/g, this.rng.pick(ERRORS))
      .replace(/\{size\}/g, String(this.rng.randomInt(5000, 100000)))
      .replace(/\{count\}/g, String(this.rng.randomInt(5, 500)))
      .replace(/\{plan\}/g, this.rng.pick(['Starter', 'Professional', 'Enterprise']))
      .replace(/\{old_product\}/g, this.rng.pick(PRODUCTS.filter(p => p !== this.product)))
      .replace(/\{feature\}/g, this.rng.pick(['SSO', 'webhooks', 'bulk import', 'custom dashboards']))
      .replace(/\{workflow\}/g, this.rng.pick(['a deployment', 'an alert', 'a report']))
      .replace(/\{event\}/g, this.rng.pick(['threshold breach', 'data sync', 'new user signup']))
      .replace(/\{days\}/g, String(this.rng.randomInt(3, 14)))
      .replace(/\{tangent\}/g, this.rng.pick(TANGENTS))
      .replace(/\{unrelated_feature\}/g, this.rng.pick(['the search function', 'email notifications', 'the API rate limits']))
      .replace(/\{ticket\}/g, String(this.ticketNum))
      .replace(/\{diagnosis\}/g, this.rng.pick(['a configuration mismatch', 'a known issue from the last release', 'an expired authentication token', 'a race condition in the sync process']))
      .replace(/\{component\}/g, this.rng.pick(['the authentication service', 'the data sync module', 'the billing system', 'the API gateway']))
      .replace(/\{cause\}/g, this.rng.pick(['a cache invalidation issue', 'an expired certificate', 'a database connection pool exhaustion']))
      .replace(/\{step1\}/g, 'Clear your browser cache')
      .replace(/\{step2\}/g, 'Log out and log back in')
      .replace(/\{step3\}/g, 'Check the integration settings panel')
      .replace(/\{aspect\}/g, this.rng.pick(['when this started', 'which specific feature', 'the error message']))
      .replace(/\{issue\}/g, this.rng.pick(['connection timeouts', 'data not syncing', 'incorrect calculations']))
      .replace(/\{action\}/g, this.rng.pick(['export data', 'run the pipeline', 'access the dashboard']));
  }

  init() {
    super.init();
    this.appendToContext(`[SYSTEM] Support session started. Product: ${this.product}. Customer personality profile: ${this.personality}. Issue category: ${this.issueCategory}.`);
  }

  nextTurn() {
    this.turn++;
    if (this.turn > this.maxTurns) { this.done = true; return null; }

    let text, eventType, eventLabel, failurePattern = null;
    this.turnInPhase++;

    const isCustomerTurn = this.turn % 2 === 0;

    if (isCustomerTurn) {
      // Customer speaks
      const shouldDrift = this.shouldInjectFailure('topic_drift');
      const shouldEscalate = this.shouldInjectFailure('sentiment_escalation');

      if (shouldEscalate && !this.escalated) {
        text = `[CUSTOMER] ${this.fillSlots(this.rng.pick(this.persona.escalation))}`;
        failurePattern = 'sentiment_escalation';
        eventLabel = 'Customer (ESCALATION)';
        this.escalated = true;
      } else if (shouldDrift) {
        // Change topic entirely
        const newCategory = this.rng.pick(Object.keys(ISSUES).filter(c => c !== this.issueCategory));
        const newIssue = this.rng.pick(ISSUES[newCategory]);
        text = `[CUSTOMER] Actually, while we're at it, I have another issue: ${this.fillSlots(newIssue)}`;
        this.issueCategory = newCategory;
        failurePattern = 'topic_drift';
        eventLabel = `Customer (DRIFT → ${newCategory})`;
      } else if (this.phase === 'greeting') {
        text = `[CUSTOMER] ${this.fillSlots(this.rng.pick(this.persona.greetings))}`;
        if (this.turn >= 2) {
          text += ` ${this.fillSlots(this.rng.pick(ISSUES[this.issueCategory]))}`;
          this.phase = 'issue';
        }
        eventLabel = 'Customer greeting';
      } else {
        text = `[CUSTOMER] ${this.fillSlots(this.rng.pick(this.persona.followups))}`;
        // Rambling personality adds extra content
        if (this.personality === 'rambling' && this.rng.chance(0.4)) {
          text += ` ${this.fillSlots(this.rng.pick(CUSTOMER_PERSONALITIES.rambling.followups))}`;
        }
        eventLabel = `Customer (${this.personality})`;
      }
      eventType = 'user_msg';
    } else {
      // Bot responds
      if (this.escalated && this.rng.chance(0.5)) {
        text = `[BOT] ${this.fillSlots(this.rng.pick(BOT_RESPONSES.escalation))}`;
        eventLabel = 'Bot escalation';
        this.phase = 'escalation';
      } else if (this.phase === 'greeting') {
        text = `[BOT] ${this.fillSlots(this.rng.pick(BOT_RESPONSES.greeting))}`;
        eventLabel = 'Bot greeting';
      } else if (this.phase === 'issue' && this.turnInPhase < 6) {
        text = `[BOT] ${this.fillSlots(this.rng.pick(BOT_RESPONSES.diagnosis))}`;
        if (this.turnInPhase >= 4) this.phase = 'diagnosis';
        eventLabel = 'Bot diagnosis';
      } else if (this.phase === 'diagnosis') {
        text = `[BOT] ${this.fillSlots(this.rng.pick(BOT_RESPONSES.resolution))}`;
        this.phase = 'resolution';
        eventLabel = 'Bot resolution';
      } else {
        // General follow-up or confusion
        text = `[BOT] ${this.fillSlots(this.rng.pick(this.rng.chance(0.3) ? BOT_RESPONSES.confusion : BOT_RESPONSES.resolution))}`;
        eventLabel = 'Bot follow-up';
      }
      eventType = 'agent_msg';
    }

    this.appendToContext(text);
    return { text, eventType, eventLabel, failurePattern };
  }
}

module.exports = { SupportBot };
