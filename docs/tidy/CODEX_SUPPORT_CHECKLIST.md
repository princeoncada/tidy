# Codex Support Checklist

Support checklist for Codex work in Tidy.

This file is support-only. Authoritative implementation rules remain in `docs/CODEX_RULES.md`, and workflow authority remains in `docs/WORKFLOW.md`.

## Intended role

Codex is the implementation and validation-evidence agent.

## Checks before editing

- Read the files named in the prompt.
- Confirm `STATE.json` matches the expected phase state.
- Keep changes limited to the assigned task.
- Preserve product, design, and workflow invariants named in the prompt.

## Summary checks

- List files changed and why.
- State whether app behavior changed.
- Include validation evidence, or state which validation remains for user/controller approval.
- Name follow-up fixes before closeout.

## Drift checks

- Do not touch unrelated files.
- Do not claim validation without evidence.
- If owner truth changes, update the owner doc instead of only `docs/tidy/*`.
