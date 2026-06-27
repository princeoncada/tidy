# Tidy Staleness Audit

Support surface for tracking stale assumptions and drift candidates. This file records audit findings; it does not own the corrected truth.

## Priority key

- **High**: can misroute agents, validation, phase closeout, or roadmap sequencing.
- **Medium**: can cause confusion, duplicated truth, or stale implementation scope.
- **Low**: cleanup quality issue with limited execution risk.

## Current audit findings

| Priority | Surface | Finding | Owner to fix | Suggested phase |
| --- | --- | --- | --- | --- |
| High | `docs/WORKFLOW.md` Roles | Current text says Claude Code architects/scopes/plans/validates and writes prompts. The new model says Claude Code is the future-plan architect and Codex-ready implementation explainer, not the final validator. | `docs/WORKFLOW.md`, `AGENTS.md` | 3.6.3 |
| High | `AGENTS.md` Roles and Implementation Gate | Current text says Claude Code scopes/plans/validates and writes Codex prompts; it also says Codex does not run validation. The new model needs Codex as implementation + validation-evidence agent and user/controller as manual-validation/closeout authority. | `AGENTS.md`, `docs/WORKFLOW.md`, `docs/CODEX_RULES.md` | 3.6.3 |
| High | `docs/CODEX_RULES.md` Validation Boundary | Current boundary states validation is user/controller-run and Codex must not execute validation. The new role model needs a deliberate rewrite that says which validations Codex may run or provide, which remain controller-run, and how evidence is reported. | `docs/CODEX_RULES.md`, `docs/WORKFLOW.md` | 3.6.3 |
| Medium | `.claude/skills/tidy-codex-prompt-builder/SKILL.md` | Skill still prohibits telling Codex to run validation and bakes in current branch/open/validation sequencing. It should be realigned only after authoritative workflow docs are updated. | `.claude/skills/tidy-codex-prompt-builder/SKILL.md` | 3.6.3 |
| Medium | `.claude/skills/tidy-validation-judge/SKILL.md` | Skill assumes user-pasted validation/status evidence and says it never runs validation. Reconcile after the Codex validation-evidence boundary is rewritten. | `.claude/skills/tidy-validation-judge/SKILL.md` | 3.6.3 |
| Medium | `docs/FUTURE_PLANS.md` | Current first Planned item is `4.0 - Expo / React Native Mobile`. The requested near-term stewardship arc inserts `3.6.0` through `3.6.4` before the Workspace OS rebase. Roadmap capture must update FUTURE_PLANS and matching next-phase pointers through the normal versioning rules. | `docs/FUTURE_PLANS.md`, `STATE.json`, `docs/AI_HANDOFF.md`, `docs/VERSIONING.md` as applicable | 3.6.0 |
| Medium | `docs/AI_HANDOFF.md` | Current product snapshot still frames Tidy as an authenticated personal todo workspace. That is accurate for runtime state, but 3.6/Workspace OS planning must avoid prematurely changing runtime truth before the RFC lands. | `docs/AI_HANDOFF.md`, future RFC owner | 3.6.4 |
| Low | `docs/tidy/*` | Support folder is new and must stay support-only. Any support finding that becomes durable truth must be moved to the owner doc. | `docs/tidy/SOURCE_OF_TRUTH_MAP.md` | ongoing |

## Audit process

1. Identify the stale or duplicate truth.
2. Name the current owner document.
3. Decide whether the fix is docs-only, workflow, skills, roadmap, or product-facing.
4. Patch the owner, not only this support file.
5. Leave this file with either `Resolved in <version>` or a remaining backlog pointer.

## Not yet audited

- `docs/deprecated/*` legacy archive.
- Older session logs and phase logs; these are historical audit only and should not be treated as active guidance.
- All `.claude/skills/*` beyond prompt-builder, validation-judge, and minimal-handoff.
