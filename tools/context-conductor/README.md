# context-conductor

> Bayesian context routing — the fix-side companion to the Bell Tuning sensors. Code lives in a private remedy repository.

## Why this directory only contains a README

contrarianAI's public repository ships the diagnostic side: the four Bell Tuning sensors that **find** agent pathologies. The remediation side — the templates that **fix** them — lives separately under a per-engagement source-available license.

context-conductor is the first such remedy: a Bayesian executive that decides per turn whether to keep the active context, swap to a saved one, or spawn fresh, driven by the same sensor signals the audit produces.

## How to access the code

context-conductor source is delivered as part of a Bell Tuning consulting engagement. Path to access:

1. Book a Bell Tuning audit at https://contrarianai-landing.onrender.com (or email `kevin.luddy39@gmail.com`)
2. If the audit surfaces a context-fault pathology, the remedy SKU includes a deployment of context-conductor, customized to your stack
3. An escrow copy of the deployed commit is provided to the client under the per-engagement license

## Reference materials that *are* public

- **Whitepaper** — *Mixture of Contexts: Bayesian Regime Routing for Agentic Workflows*. Algorithm derivation, sweep protocol, and audit-product implications. Public copy lives in the audit deliverable; an earlier version is preserved in the archived Node reference repo (link below).
- **Archived Node reference implementation** — `https://github.com/kevin-luddy39/context-conductor` (read-only, deprecated). Validates the algorithm against four scenarios with n=100 sweep: combined precision 0.987 ± 0.036.
- **Bell Tuning sensors** — public, MIT-licensed, in this same repository under `tools/context-inspector/`, `tools/retrieval-auditor/`, `tools/tool-call-grader/`, `tools/predictor-corrector/`.

## License posture

| Artifact | License | Where |
|----------|---------|-------|
| Bell Tuning sensors | MIT | `contrarianAI/tools/<sensor>/` (this repo, public) |
| Whitepapers | Public, all-rights-reserved on text | `contrarianAI/tools/<sensor>/docs/` (this repo, public) |
| context-conductor (and other remedies) | Per-engagement source-available | `contrarianai-remedies` (private) |

The asymmetry is intentional: sensors are the magnet, remedies are the asset.
