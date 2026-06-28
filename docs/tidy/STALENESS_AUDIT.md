# Tidy Staleness Audit

Support surface for tracking stale assumptions and drift candidates. This file records audit findings; it does not own the corrected truth.

## Priority key

- **High**: can misroute agents, validation, phase closeout, or roadmap sequencing.
- **Medium**: can cause confusion, duplicated truth, or stale implementation scope.
- **Low**: cleanup quality issue with limited execution risk.

## Current audit findings

| Priority | Surface | Finding | Owner | Proposed action | Status | Follow-up phase |
| --- | --- | --- | --- | --- | --- | --- |
| High | `docs/WORKFLOW.md` Roles | Current text says Claude Code architects/scopes/plans/validates and writes prompts. The new model says Claude Code is the future-plan architect and Codex-ready implementation explainer, not the final validator. | `docs/WORKFLOW.md`, `AGENTS.md` | Rewrite the Claude Code role to future-plan architect / implementation explainer that no longer owns final validation. Record only; do not edit the owner doc in this phase. | Open - deferred | 3.6.3 |
| High | `AGENTS.md` Roles and Implementation Gate | Current text says Claude Code scopes/plans/validates and writes Codex prompts; it also says Codex does not run validation. The new model needs Codex as implementation + validation-evidence agent and user/controller as manual-validation/closeout authority. | `AGENTS.md`, `docs/WORKFLOW.md`, `docs/CODEX_RULES.md` | Rewrite the role split so Codex owns implementation + validation evidence and the user/controller owns manual validation and closeout. Record only; do not edit yet. | Open - deferred | 3.6.3 |
| High | `docs/CODEX_RULES.md` Validation Boundary | Current boundary states validation is user/controller-run and Codex must not execute validation. The new role model needs a deliberate rewrite that says which validations Codex may run or provide, which remain controller-run, and how evidence is reported. | `docs/CODEX_RULES.md`, `docs/WORKFLOW.md` | Rewrite the validation boundary to define which validations Codex may run/provide, which stay controller-run, and how evidence is reported. Record only; do not edit yet. | Open - deferred | 3.6.3 |
| Medium | `.claude/skills/tidy-codex-prompt-builder/SKILL.md` | Skill still prohibits telling Codex to run validation and bakes in current branch/open/validation sequencing. It should be realigned only after authoritative workflow docs are updated. | `.claude/skills/tidy-codex-prompt-builder/SKILL.md` | Realign the skill only after the owner workflow docs are rewritten. Record only; do not edit yet. | Open - deferred | 3.6.3 |
| Medium | `.claude/skills/tidy-validation-judge/SKILL.md` | Skill assumes user-pasted validation/status evidence and says it never runs validation. Reconcile after the Codex validation-evidence boundary is rewritten. | `.claude/skills/tidy-validation-judge/SKILL.md` | Reconcile the skill after the Codex validation-evidence boundary is rewritten. Record only; do not edit yet. | Open - deferred | 3.6.3 |
| Medium | `docs/FUTURE_PLANS.md` | Current first Planned item is `4.0 - Expo / React Native Mobile`. The requested near-term stewardship arc inserts `3.6.0` through `3.6.4` before the Workspace OS rebase. Roadmap capture must update FUTURE_PLANS and matching next-phase pointers through the normal versioning rules. | `docs/FUTURE_PLANS.md`, `STATE.json`, `docs/AI_HANDOFF.md`, `docs/VERSIONING.md` | 3.6 stewardship arc (3.6.0-3.6.4) captured in FUTURE_PLANS with matching STATE/handoff/versioning pointers; the old 4.0 Expo/RN and 4.1 MCP items were superseded into the 4.0 Workspace OS deferral boundary. No further action. | Resolved in 3.6.0 | none |
| Medium | `docs/AI_HANDOFF.md` | Current product snapshot still frames Tidy as an authenticated personal todo workspace. That is accurate for runtime state, but 3.6/Workspace OS planning must avoid prematurely changing runtime truth before the RFC lands. | `docs/AI_HANDOFF.md`, future RFC owner | Keep the current todo-runtime snapshot truthful; do not pre-change runtime framing before the Workspace OS RFC lands. Record only. | Open - deferred | 3.6.4 |
| Medium | `docs/deprecated/*` legacy archive | The legacy archive held old reverse-engineering, prompt-template, optimistic-sync, task-routing, testing, and validation docs, each banner-deprecated or topic-superseded by a live owner. | `docs/deprecated/*`, `docs/CONTEXT_INDEX.md`, `docs/FUTURE_PLANS.md` | Verified per file that each was superseded by a live owner (AI_HANDOFF, DECISIONS, CODEX_RULES, WORKFLOW, PHASE_LOG, prisma/schema); retired the whole archive and removed the FUTURE_PLANS retirement PND and the CONTEXT_INDEX deprecated-docs read note. Version history in `docs/VERSIONING.md` and the SESSION_LOG archival record preserve the archival fact. | Resolved in 3.6.2 | none |
| Medium | `scripts/export-chatgpt-review-context.ps1` | The ChatGPT evidence-packet script still prints stale role/phase copy, including "ChatGPT Architect Mode" and an old `1.4.0` scoping instruction, while the current model is ChatGPT reviewer/stewardship support. | `scripts/export-chatgpt-review-context.ps1`, `docs/WORKFLOW.md` | Realign the support packet copy with the 3.6.3 role model after authoritative workflow docs are updated. Record only; do not edit scripts in this phase. | Open - deferred | 3.6.3 |
| Medium | `docs/AI_HANDOFF.md` Forward Arc Invariants | The forward-arc invariant named a future Expo/React Native client as `4.0` and pointed at a `3.0 Collaboration Arc` owner block that the roadmap redirect removed from `docs/FUTURE_PLANS.md`. | `docs/AI_HANDOFF.md`, `docs/FUTURE_PLANS.md` | Reconciled the forward-arc wording: kept the Replicache single-spine runtime invariant truthful, reframed a native/mobile client as deferred 4.0 Workspace OS work, and repointed the owner reference to the live 4.0 Workspace OS Rebase Arc. | Resolved in 3.6.2 | none |
| Low | `docs/tidy/*` | Support folder is new and must stay support-only. Any support finding that becomes durable truth must be moved to the owner doc. | `docs/tidy/SOURCE_OF_TRUTH_MAP.md` | Keep docs/tidy/* support-only; move any durable truth to its owner doc as it arises. | Open - ongoing | ongoing |

## Cleanup backlog

- Done (3.6.0): captured `3.6.0 - Tidy Stewardship Foundation` through `3.6.4 - Workspace OS Rebase RFC` in `docs/FUTURE_PLANS.md` through the normal phase workflow.
- Done (3.6.2): retired the `docs/deprecated/*` legacy archive after per-file supersession verification and reconciled the `docs/AI_HANDOFF.md` forward-arc wording; routing and roadmap references updated.
- Realign role boundaries in `AGENTS.md`, `docs/WORKFLOW.md`, and `docs/CODEX_RULES.md` (deferred to 3.6.3).
- Update relevant `.claude/skills/*` after owner docs are corrected (deferred to 3.6.3).
- Keep `docs/tidy/*` support-only (ongoing).

## Audit process

1. Identify the stale or duplicate truth.
2. Name the current owner document.
3. Decide whether the fix is docs-only, workflow, skills, roadmap, or product-facing.
4. Patch the owner, not only this support file.
5. Leave this file with either `Resolved in <version>` or a remaining backlog pointer.

## Audited in 3.6.1

- `docs/deprecated/*` legacy archive: new findings-table row added for per-file consolidation or retirement in 3.6.2.
- `scripts/` (commit/open-phase/promote/validate + generators): core phase/version/validation/generator scripts audited clean; new findings-table row added for stale ChatGPT support-packet copy in `scripts/export-chatgpt-review-context.ps1`.
- `app/generated/prisma`: generated output, excluded from stewardship edits; audited clean - generated banner confirms "Do not edit directly."
- Source-path references in `docs/tidy/*` and the docs root: new findings-table row added for stale `docs/AI_HANDOFF.md` forward-arc mobile `4.0` wording; no stewardship edit to owner docs in this phase.
- Remaining `.claude/skills/*` beyond prompt-builder, validation-judge, and minimal-handoff: audited clean - no additional stale role, validation, or prompt-boundary finding beyond existing rows.

## Deferred (historical, out of scope)

- Older session logs and phase logs are historical audit only and are not active guidance; no stewardship edit in this arc.
