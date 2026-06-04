# Eval: <short title>

- **Eval ID:** <kebab-id>
- **Phase / capability:** <version - phase, or capability name>
- **Type:** capability check | regression check
- **Owner / reviewer:** <who signs off>

## Preconditions

<state, data, env, or branch required before running>

## Steps

1. <step>
2. <step>

## Required proof

<the exact output, evidence, or described artifact that demonstrates a pass>

## Pass criteria

<what must be true to pass>

## Fail criteria / rollback

<what counts as a fail and what to do>

## Human-review gate

<what a human must confirm before this eval is considered passed>

## Run log

Raw run output goes to .tidy-ai/eval-runs/<eval-id>-<date>.md (local, gitignored).
Do not commit raw run logs; commit only an intentional summary if needed.

## Validation boundary

Codex cannot claim this eval passed. Only user/controller-provided evidence can.
scripts/validate.ps1 remains the final gate.
