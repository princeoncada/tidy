# Codex Support Checklist

Support checklist for Codex work in Tidy.

This file is support-only. The authoritative implementation rules remain in `docs/CODEX_RULES.md`, and workflow authority remains in `docs/WORKFLOW.md`.

## Intended role

Codex is the implementation and validation-evidence agent.

Codex should:

- implement from Claude Code's scoped master prompt;
- keep changes limited to the assigned files and task;
- run or provide required automated validation according to the current repo rules;
- report validation evidence clearly;
- identify required follow-up fixes before closeout;
- avoid closing phases without user/controller approval unless the authoritative workflow explicitly changes.

## Before editing

- Read the files named in the prompt before changing code or docs.
- Confirm `STATE.json` matches the expected phase state.
- Preserve product, design, and workflow invariants named in the prompt.
- Identify the smallest file set needed for the change.

## Summary expectations

- List files changed and why.
- State whether app behavior changed.
- Include validation evidence or state which validation remains for the user/controller.
- Name any discovered follow-up that belongs in `docs/FUTURE_PLANS.md`, `docs/AI_HANDOFF.md`, or `docs/tidy/STALENESS_AUDIT.md`.

## Drift checks

- Does the implementation touch unrelated files? Stop and narrow scope.
- Does the summary claim validation without evidence? Correct it.
- Does the work change owner truth? Update the owner document, not only `docs/tidy/*`.
