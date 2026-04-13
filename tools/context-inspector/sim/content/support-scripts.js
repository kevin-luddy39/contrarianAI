/**
 * Customer support bot simulation content.
 */

const PRODUCTS = ['CloudSync Pro', 'DataVault Enterprise', 'StreamPipe Analytics', 'AutoDeploy CI/CD'];

const ISSUES = {
  billing: [
    "I was charged twice for my {product} subscription this month. Order #{order}. Amount: ${amount}.",
    "My invoice shows ${amount} but the quoted price was ${quoted}. Can you explain the difference for {product}?",
    "I need to update the credit card on file for account #{account}. The current one expires next week.",
  ],
  technical: [
    "The {product} dashboard is showing a 502 error when I try to access the analytics panel. Started about {time} ago.",
    "Our {product} integration with {integration} stopped syncing data as of {date}. Error in logs: '{error}'.",
    "Performance degradation on {product}: API response times went from 200ms to 3.5 seconds after the latest update.",
    "The export function in {product} generates corrupted CSV files when the dataset exceeds {size} rows.",
  ],
  feature: [
    "Does {product} support SSO with Okta? We need SAML 2.0 integration for our compliance requirements.",
    "I'd like to request a bulk import feature for {product}. Currently we're manually entering {count} records per week.",
    "When will {product} support custom webhooks? Our team needs to trigger {workflow} when {event} occurs.",
  ],
  account: [
    "I need to add {count} new users to our {product} team plan. Current plan: {plan}.",
    "We're migrating from {old_product} to {product}. Is there a data migration tool available?",
    "Please cancel our {product} subscription effective {date}. Reason: switching to a competitor that offers {feature}.",
  ],
};

const CUSTOMER_PERSONALITIES = {
  patient: {
    greetings: ["Hi there, I have a question about my account.", "Hello, I hope you can help me with something."],
    followups: ["Thanks for looking into that.", "I appreciate your help.", "No rush, I can wait."],
    escalation: ["I understand this is complex. Would it help to involve a specialist?"],
  },
  frustrated: {
    greetings: ["This is the third time I'm reaching out about this issue.", "I've been waiting for a resolution for {days} days now."],
    followups: ["This still isn't resolved.", "When exactly will this be fixed?", "I need a concrete timeline, not platitudes."],
    escalation: ["I want to speak to a manager.", "This level of service is unacceptable for what we're paying.", "I'm considering switching providers if this isn't resolved today."],
  },
  rambling: {
    greetings: [
      "So I was trying to use the product and it reminded me of when we had a similar issue last year with our old vendor. Anyway, the actual problem is...",
      "I know this might sound complicated but bear with me. Our team has a unique setup where we run {product} alongside {integration} and also {tool}, and the way our workflow is structured..."
    ],
    followups: [
      "Oh and while I have you, I also noticed something else unrelated — {tangent}.",
      "That reminds me, we also had trouble with {unrelated_feature} last month. Can you check on that too?",
    ],
    escalation: ["I've been going back and forth on this for a while now and I just need someone who can see the big picture of all our issues together."],
  },
};

const BOT_RESPONSES = {
  greeting: [
    "Hello! I'm the {product} support assistant. How can I help you today?",
    "Welcome to {product} support. I can help with billing, technical issues, and account management. What's going on?",
  ],
  diagnosis: [
    "I can see the issue on our end. It looks like {diagnosis}. Let me check if there's a known fix.",
    "Based on what you've described, this appears to be related to {component}. I'm pulling up the relevant documentation.",
    "I've found a similar case in our system. The root cause was {cause}. Let me walk you through the resolution.",
  ],
  resolution: [
    "I've applied the fix on our end. The change should take effect within {time}. Can you verify on your end?",
    "Here are the steps to resolve this: 1) {step1}, 2) {step2}, 3) {step3}. Let me know if you get stuck on any step.",
  ],
  escalation: [
    "I understand your frustration. Let me escalate this to our senior support team. Reference: #{ticket}.",
    "This requires specialist attention. I'm creating a priority ticket #{ticket} and looping in the engineering team.",
  ],
  confusion: [
    "I'm not entirely sure I understand the issue. Could you provide more details about {aspect}?",
    "Let me make sure I have this right: you're experiencing {issue} when you try to {action}. Is that correct?",
  ],
};

const TANGENTS = [
  "the new UI font looks different",
  "our CEO wants a demo for the board meeting",
  "we're also evaluating your competitor",
  "the mobile app crashes sometimes",
  "our intern accidentally deleted some data",
  "we need to update our billing address",
];

const INTEGRATIONS = ['Salesforce', 'Slack', 'Jira', 'GitHub', 'Datadog', 'PagerDuty', 'Snowflake'];
const ERRORS = ['CONNECTION_TIMEOUT', 'AUTH_EXPIRED', 'RATE_LIMIT_EXCEEDED', 'SCHEMA_MISMATCH', 'NULL_POINTER'];

module.exports = {
  PRODUCTS, ISSUES, CUSTOMER_PERSONALITIES, BOT_RESPONSES,
  TANGENTS, INTEGRATIONS, ERRORS,
};
