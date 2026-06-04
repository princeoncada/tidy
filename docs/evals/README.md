# Phase Eval Artifacts

Lightweight, committed eval definitions that describe what a phase or capability
must prove. Eval definitions are documentation, not an automated runner, and they
never bypass the validation boundary.

## What an eval definition is

A committed Markdown file under docs/evals/ that states, for one capability or
phase: what to prove, the steps, the required proof, the human-review gate, and
the pass/fail criteria. Copy docs/evals/template.md to docs/evals/<id>.md and
fill it in.

## Boundary (unchanged)

- Eval DEFINITIONS are committed; raw eval RUN logs stay local under
  .tidy-ai/eval-runs/ (already gitignored) unless a summary is intentionally
  committed.
- Codex never claims an eval passed; only user/controller-provided evidence can.
- scripts/validate.ps1 remains the final gate. An eval definition complements
  tests and validation; it does not replace them.

## When to add one

Add an eval definition when a phase has capability or regression behavior worth a
durable, reviewable proof. Evals are optional per phase, not mandatory. Prefer
tests for anything automatable; use an eval definition for human-reviewed or
hard-to-automate proofs.

## Operating evals

Use the tidy-eval-harness skill to draft a new eval from the template or to run
an existing one. Raw run output is written locally to .tidy-ai/eval-runs/ and is
never committed.
