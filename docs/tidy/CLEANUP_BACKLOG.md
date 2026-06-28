# Tidy Cleanup Backlog

Support backlog for stewardship work.

This file is not the roadmap. Accepted phase sequencing belongs in `docs/FUTURE_PLANS.md`.

## Proposed 3.6 support sequence

- `3.6.0 - Tidy Stewardship Foundation`
- `3.6.1 - Repo Staleness Audit`
- `3.6.2 - Docs Consolidation Cleanup`
- `3.6.3 - Agent Workflow Realignment`
- `3.6.4 - Workspace OS Rebase RFC`

## Immediate backlog

- Done (3.6.2): retired the `docs/deprecated/*` legacy archive (25 files) after per-file supersession verification, reconciled the `docs/AI_HANDOFF.md` forward-arc wording, and updated routing/roadmap references.
- Done (3.6.3): rewrote the agent role model - Claude Code = future-plan architect / implementation explainer (no longer final validator); Codex = implementer + automated-validation runner/evidence reporter; ChatGPT = second-opinion/docs-workflow auditor; user/controller = manual validation + closeout - across `docs/WORKFLOW.md`, `AGENTS.md`, `docs/CODEX_RULES.md`, the two skills, `scripts/export-chatgpt-review-context.ps1`, and `docs/tidy/CHATGPT_SUPPORT_CHECKLIST.md`.

1. Done (3.6.0): captured the 3.6 stewardship arc in `docs/FUTURE_PLANS.md` through the normal versioning workflow.
2. Done (3.6.3): realigned role boundaries in `AGENTS.md`, `docs/WORKFLOW.md`, and `docs/CODEX_RULES.md` to the architect / implementer+validation-runner / auditor / user-closeout model.
3. Done (3.6.3): updated `.claude/skills/tidy-codex-prompt-builder/SKILL.md` to the new validation-execution boundary.
4. Done (3.6.3): updated `.claude/skills/tidy-validation-judge/SKILL.md` to accept Codex-reported automated evidence.
5. Audit remaining `.claude/skills/*` for stale role, validation, or prompt-boundary assumptions.
6. Prepare the Workspace OS Rebase RFC after agent workflow roles are hardened.

## Cleanup rules

- Do not promote support docs into source-of-truth owners.
- Do not edit product source as part of stewardship unless explicitly scoped.
- Do not rewrite historical logs except to update indexes or deprecate pointers.
- Keep roadmap truth in `docs/FUTURE_PLANS.md`.
- Keep current architecture truth in `docs/AI_HANDOFF.md`.
- Keep design truth in `docs/design.md`.
- Keep workflow and validation-boundary truth in `docs/WORKFLOW.md` and `docs/CODEX_RULES.md`.
