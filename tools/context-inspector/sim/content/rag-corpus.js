/**
 * Synthetic document corpus for RAG pipeline simulation.
 * Four domains with 4 documents each = 16 total.
 */

const DOMAINS = {
  ml_ops: [
    'Model deployment pipelines require careful versioning of both model artifacts and their serving configurations. A/B testing frameworks should support gradual traffic shifting with automated rollback when latency exceeds p99 thresholds. Feature stores must maintain consistency between training-time and inference-time feature computations to avoid training-serving skew.',
    'GPU utilization monitoring reveals that most inference workloads operate at 15-30% GPU utilization due to batching inefficiencies. Dynamic batching with timeout-based flushing can improve utilization to 60-80%. Memory fragmentation from variable-length sequences requires careful attention to padding strategies and key-value cache management.',
    'Model registry best practices include storing model lineage metadata, training dataset hashes, and evaluation metrics alongside artifacts. Canary deployments with shadow scoring allow comparison of new model versions against production baselines without exposing users to potentially degraded predictions.',
    'Continuous training pipelines must handle data drift detection through statistical tests on incoming feature distributions. Population Stability Index and Kolmogorov-Smirnov tests provide early warning when retraining is needed. Automated retraining triggers should include human approval gates for production model swaps.',
  ],
  security: [
    'API authentication for AI endpoints requires rate limiting at both the user and token level. JWT tokens with short expiration windows prevent replay attacks on expensive inference endpoints. Service mesh patterns enable per-route authentication policies that can differentiate between read-only prediction requests and write operations that modify model state.',
    'Prompt injection attacks exploit the inability of language models to distinguish between system instructions and user input. Defense strategies include input sanitization, output filtering, and architectural separation between the instruction-following layer and the tool-execution layer. Canary tokens embedded in system prompts can detect extraction attempts.',
    'Data privacy in AI systems requires attention to model memorization risks. Differential privacy techniques during training add calibrated noise to gradients, providing mathematical guarantees about the maximum information leakage about any individual training example. Federated learning approaches keep raw data at the edge while aggregating model updates centrally.',
    'Supply chain security for AI involves verifying the integrity of pre-trained model weights, scanning for backdoors in fine-tuned models, and maintaining SBOMs for all dependencies in the inference stack. Model provenance tracking ensures that production models can be traced back to their training data, code, and configuration.',
  ],
  data_eng: [
    'Streaming data architectures for AI feature computation use Apache Kafka or Pulsar as the event backbone with Flink or Spark Structured Streaming for windowed aggregations. Late-arriving events require watermark strategies that balance completeness against latency. Exactly-once semantics in the feature pipeline prevent double-counting in financial applications.',
    'Data quality frameworks for ML pipelines must validate schema compliance, statistical distributions, and cross-column constraints at every stage. Great Expectations and Deequ provide declarative constraint definitions that run as pipeline stages. Quarantine tables capture validation failures for manual review without blocking the main pipeline.',
    'Lakehouse architectures unify batch and streaming analytics on a single storage layer using Delta Lake, Iceberg, or Hudi. Time-travel capabilities enable reproducible training datasets by pinning queries to specific table versions. Schema evolution support allows adding new features without rebuilding historical partitions.',
    'ETL pipeline observability requires lineage tracking at the column level, not just the table level. When an AI model produces unexpected predictions, column-level lineage enables root cause analysis by tracing the prediction back through feature transformations to the source system where the anomaly originated.',
  ],
  product: [
    'AI product metrics should measure task completion rate and user trust, not just model accuracy. A 95% accurate model that users distrust performs worse than an 80% accurate model that users rely on. Trust calibration metrics track whether users override, accept, or ignore AI suggestions over time.',
    'Progressive disclosure of AI capabilities reduces cognitive load and builds trust incrementally. Start with simple, high-confidence suggestions and gradually introduce more complex AI features as users demonstrate comfort. Feature flags per user segment enable controlled rollout with engagement monitoring at each stage.',
    'Human-AI interaction patterns for enterprise tools require explicit confidence indicators, clear escalation paths to human experts, and explanations that match the user domain vocabulary. Generic confidence scores like "87% sure" are meaningless without domain context. Instead, map confidence to actionable categories: "verified," "likely correct," and "needs human review."',
    'Feedback loops in AI products must close within the user session. Delayed feedback (thumbs up/down after the interaction) captures less than 5% of user sentiment. Inline correction mechanisms where users edit the AI output provide both immediate value and high-quality training signals for model improvement.',
  ],
};

// Cross-domain "noise" documents that dilute focus
const NOISE_DOCS = [
  'Company quarterly all-hands notes: Q3 revenue exceeded targets by 12%. New office lease signed in Austin. Parking policy changes effective November 1st. Holiday party scheduled for December 15th at the downtown venue.',
  'Internal memo regarding desk reservation system migration from FlexDesk to HotDesk Pro. Training sessions available Tuesday and Thursday. Please update your preferences in the new system by end of week.',
  'Recipe for team lunch: preheat oven to 375 degrees. Combine flour, sugar, and butter until crumbly. Press into pan and bake for 12 minutes. Meanwhile, whisk eggs with vanilla and condensed milk for the filling.',
  'Travel policy update: all international travel requires VP approval 14 days in advance. Economy class for flights under 6 hours. Hotel per diem capped at $200/night for tier 1 cities. Uber receipts must include destination.',
];

module.exports = { DOMAINS, NOISE_DOCS };
