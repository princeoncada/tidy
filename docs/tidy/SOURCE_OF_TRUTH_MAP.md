# Tidy Source-of-Truth Map

Support surface for repo stewardship. This file maps where truths live so ChatGPT, Claude Code, Codex, and the user/controller can audit drift without creating duplicate owners.

This file is not a roadmap, handoff, design system, version oracle, implementation prompt, or validation contract.

## Owners

| Truth | Owner | Support use |
| --- | --- | --- |
| Version, state, current phase, phase title, next phase | `STATE.json` | Read first before answering state or next-work questions. Never infer from memory. |
| Forward roadmap and planned phases | `docs/FUTURE_PLANS.md` | Use to confirm the first Planned item and roadmap sequencing. Do not duplicate roadmap state here. |
| Current product architecture, invariants, risks, and key runtime files | `docs/AI_HANDOFF.md` | Use for architecture and drift review. Update only when current architecture or risks change. |
| UI/design contracts, semantic tokens, accessibility, and visual parity | `docs/design.md` | Use for design/runtime drift audits and visual implementation scope. |
| Version rules and completed-version history | `docs/VERSIONING.md` | Use for versioning rules, stable/alpha constraints, and release-history lookup. |
| Phase workflow, role boundaries, prompt format, validation-gated responses | `docs/WORKFLOW.md` | Use when writing/reviewing Codex prompts or closeout guidance. |
| Codex implementation rules, scope control, tests, commit discipline, validation boundary | `docs/CODEX_RULES.md` | Use when reviewing implementation prompts or Codex output. |
| Task routing and smallest read-set selection | `docs/CONTEXT_INDEX.md` | Use to choose what to read next; do not treat as a rules owner. |
| Code routing/orientation | `codebase-graph.json` | Use only to narrow files to inspect directly. It is not product truth. |
| Operational Claude Code procedures | `.claude/skills/*` | Execution-layer instructions; audit for drift against AGENTS/WORKFLOW/CODEX rules. |
| Tidy stewardship support | `docs/tidy/*` | Audit support, checklists, cleanup notes, and role-readiness checks only. Start ChatGPT setup with `docs/tidy/CHATGPT_ROLE_SETUP.md`. |

## Role-truth ownership

| Role truth | Primary owner to update | Support files that may reference it |
| --- | --- | --- |
| ChatGPT role and evidence boundary | `docs/WORKFLOW.md` and `AGENTS.md` | `docs/tidy/CHATGPT_ROLE_SETUP.md`, `docs/tidy/CHATGPT_SUPPORT_CHECKLIST.md`, `docs/tidy/STALENESS_AUDIT.md` |
| Claude Code planning/prompt-builder role | `docs/WORKFLOW.md`, `AGENTS.md`, `.claude/skills/tidy-codex-prompt-builder/SKILL.md` | `docs/tidy/CLAUDE_CODE_SUPPORT_CHECKLIST.md` |
| Codex implementation and validation-evidence role | `docs/WORKFLOW.md`, `docs/CODEX_RULES.md`, `AGENTS.md` | `docs/tidy/CODEX_SUPPORT_CHECKLIST.md` |
| User/controller manual-validation and closeout authority | `docs/WORKFLOW.md`, `AGENTS.md` | all support checklists |

## Stewardship rule

When a support-file finding changes product truth, roadmap truth, version truth, workflow truth, or design truth, update the owner. Do not let `docs/tidy/*` become the only place that says the truth.
