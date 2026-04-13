/**
 * Agent persona templates for multi-agent orchestration simulation.
 */

const COORDINATOR = {
  dispatch: [
    '[COORDINATOR] Task received: {task}. Dispatching to {agent} for analysis.',
    '[COORDINATOR] Routing this to {agent}. Priority: {priority}. Context summary: {summary}.',
    '[COORDINATOR] Breaking down the request into subtasks. Assigning {task} to {agent}.',
  ],
  synthesize: [
    '[COORDINATOR] Received reports from all agents. Synthesizing findings. Key points: {findings}.',
    '[COORDINATOR] Agent reports compiled. {agent1} found {finding1}. {agent2} found {finding2}. Merging into final response.',
    '[COORDINATOR] All subtasks complete. Combining {count} agent outputs into unified recommendation.',
  ],
  overhead: [
    '[COORDINATOR] Recapping full context for next phase: Original request was {original}. Previous findings include {previous}. Current status: {status}. Next step: {next}.',
    '[COORDINATOR] Context checkpoint — we are on iteration {iter} of the analysis pipeline. Total tokens consumed: approximately {tokens}. Remaining budget: {budget}.',
  ],
};

const RESEARCHER = {
  work: [
    '[RESEARCHER] Analyzing {topic}. Initial findings: {findings}. Sources consulted: {sources}. Confidence level: {confidence}.',
    '[RESEARCHER] Deep dive on {topic} complete. Found {count} relevant patterns. Key insight: {insight}. Recommending further analysis of {related}.',
    '[RESEARCHER] Literature review for {topic}: The consensus approach uses {approach}. However, recent work suggests {alternative} may be more effective for this use case.',
  ],
  toolCall: [
    '[RESEARCHER] Calling search_documents({query})\nResult: Found {count} matching documents. Top result: "{title}" with relevance score {score}.',
    '[RESEARCHER] Calling analyze_data({dataset})\nResult: {rows} rows processed. Statistical summary: mean={mean}, std={std}, p95={p95}.',
  ],
};

const CODER = {
  work: [
    '[CODER] Implementing {feature}. Approach: {approach}. Estimated complexity: {complexity}.\n\n```python\ndef {function_name}({params}):\n    """{docstring}"""\n    {implementation}\n    return {return_val}\n```',
    '[CODER] Refactoring {component} to address {issue}. Changes: modified {files} files, added {tests} tests. Key change: {description}.',
    '[CODER] Building {feature}. Using {framework} with {pattern} pattern. Integration points: {integrations}.',
  ],
  toolCall: [
    '[CODER] Calling run_tests({suite})\nResult: {passed}/{total} tests passed. {failed} failures in {module}. Error: {error}.',
    '[CODER] Calling lint_code({path})\nResult: {warnings} warnings, {errors} errors. Most common: {issue}.',
  ],
};

const REVIEWER = {
  work: [
    '[REVIEWER] Reviewing output from {agent}. Assessment: {assessment}. Quality score: {score}/10. Issues found: {issues}.',
    '[REVIEWER] Code review complete. Approving with {count} suggestions: {suggestions}. No blocking issues found.',
    '[REVIEWER] Evaluation of {deliverable}: correctness {correct}/5, completeness {complete}/5, efficiency {efficient}/5. Overall: {verdict}.',
  ],
  selfEval: [
    '[REVIEWER] Re-evaluating my own previous assessment. On second look, the quality score should be {score}/10 instead of the previously reported value. Adjusting recommendations accordingly.',
    '[REVIEWER] Self-check: my review of {agent}\'s work appears consistent with the original requirements. Confidence in assessment: {confidence}%.',
  ],
};

const TOPICS = [
  'data pipeline optimization', 'model serving latency', 'feature store implementation',
  'authentication middleware', 'rate limiting strategy', 'context window management',
  'vector database selection', 'prompt template versioning', 'evaluation framework design',
  'cost optimization analysis', 'error handling patterns', 'session management architecture',
];

const PRIORITIES = ['high', 'medium', 'low', 'critical'];
const COMPLEXITIES = ['O(n)', 'O(n log n)', 'O(n²)', 'constant time'];
const VERDICTS = ['approved', 'approved with changes', 'needs revision', 'rejected'];

module.exports = {
  COORDINATOR, RESEARCHER, CODER, REVIEWER,
  TOPICS, PRIORITIES, COMPLEXITIES, VERDICTS,
};
