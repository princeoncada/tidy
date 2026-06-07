# Tidy AI Harness

Optional, repo-native convenience layer for AI agents working in Tidy. It is
opt-in. It changes no product behavior and adds nothing to the session startup
read set.

## What this is

- hooks/ - opt-in, profile-gated hook templates that are inactive by default.

Operational skills live as real Claude Code skills under `.claude/skills/`
(see docs/WORKFLOW.md "Skill Surface" for the registry); this harness no
longer keeps skill pointers.

## Hard rules

- Source of truth stays in the existing docs. The harness only routes to them.
- No startup read growth. Startup still reads only STATE.json,
  codebase-graph.json, and docs/FUTURE_PLANS.md per the AGENTS.md Session Start
  Protocol.
- No product behavior change.
- No committed local memory. The .tidy-ai/ local agent memory added in 1.5.1 is
  gitignored, written only by opt-in hooks, and is never committed.
- The Codex validation boundary is unchanged: validation is user/controller-run.

## Source-of-truth pointers

- STATE.json - version, state, phase, nextPhase oracle.
- docs/FUTURE_PLANS.md - roadmap owner.
- docs/AI_HANDOFF.md - current product state, invariants, risks.
- docs/WORKFLOW.md - process and phase workflow.
- docs/CODEX_RULES.md - implementation rules, validation boundary, tests.
- docs/CONTEXT_INDEX.md - routing-only read-set selection map.
