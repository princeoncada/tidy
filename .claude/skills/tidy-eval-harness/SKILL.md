---
name: tidy-eval-harness
description: Create or run a Tidy phase eval definition (capability or regression proof) using docs/evals/template.md. Use when a phase needs a committed proof artifact. Keeps raw run logs local and preserves the user-run validation boundary.
---

# tidy-eval-harness

Trigger / use case: a phase or capability needs a committed, lightweight proof artifact (capability check or regression check), or you are running an existing eval definition.

Read set (exact):
- docs/evals/README.md - the eval artifact format and boundary.
- docs/evals/template.md - the eval definition template to copy.
- docs/CODEX_RULES.md - the validation boundary an eval must not bypass.

Do not read: product source unless an eval explicitly targets it; docs/PHASE_LOG.md; docs/SESSION_LOG/.

Allowed actions: draft a committed eval definition from the template; describe how a human/controller runs it; point raw run logs to the local, gitignored .tidy-ai/eval-runs/ path.

Prohibited actions: claiming an eval passed without user-provided evidence; running validation; committing raw run logs; treating an eval definition as a replacement for validate.ps1.

Output contract:
- New eval: a committed docs/evals/<id>.md filled from the template (id, capability/regression type, preconditions, steps, required proof, human-review gate, pass/fail criteria, run-log location).
- Running an eval: the steps to run, where the local run log goes (.tidy-ai/eval-runs/), and a verdict drawn only from user-provided evidence.

Refusal rules: never assert a pass without pasted evidence; validate.ps1 remains the final gate; raw run logs stay local and uncommitted.

Source of truth: docs/evals/README.md + docs/evals/template.md (format) and docs/CODEX_RULES.md (validation boundary).
