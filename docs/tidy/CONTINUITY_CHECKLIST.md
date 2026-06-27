# Tidy Continuity Checklist

Support surface for keeping Tidy sessions recoverable across ChatGPT, Claude Code, Codex, and the user/controller.

This file is not a session log, roadmap, handoff, or implementation prompt. Normal continuation still uses the repo source-of-truth files and the minimal handoff skill.

## Session start

- Read `STATE.json` before answering version, state, phase, or next-phase questions.
- Read `codebase-graph.json` for routing only when present.
- Read `docs/FUTURE_PLANS.md` fresh for the first Planned roadmap item.
- Use `docs/CONTEXT_INDEX.md` to choose any additional read set.
- Do not infer continuity from memory or a prior chat when pushed repo state says otherwise.

## Before roadmap or workflow edits

- Confirm whether the current state is stable or alpha.
- If stable, confirm that any new phase sequencing keeps `STATE.json.nextPhase` aligned with the first Planned item once the change is complete.
- Keep support docs out of roadmap ownership; roadmap state belongs in `docs/FUTURE_PLANS.md`.
- Check whether the change affects role boundaries in `AGENTS.md`, `docs/WORKFLOW.md`, `docs/CODEX_RULES.md`, or `.claude/skills/*`.

## Before source or design review

- Read `docs/AI_HANDOFF.md` for current architecture invariants and risks.
- Read `docs/design.md` for visual and accessibility contracts when UI is in scope.
- Use the graph to select likely files, then read those files directly.
- State whether review is pushed-remote-only or includes pasted local evidence.

## During alpha work

- Do not promote or close from assumption.
- Require validation evidence before declaring green.
- Commit meaningful alpha work before issuing an in-alpha fix prompt.
- Keep one phase per session; after promotion, emit a minimal handoff and stop.

## Closeout readiness

- User/controller has approved required manual validation.
- Codex validation evidence is present or the workflow explicitly says which validation remains user/controller-run.
- `git status --short` is clean before irreversible closeout commands.
- Any stale support findings have either been fixed in the owner doc or moved to `docs/tidy/CLEANUP_BACKLOG.md`.

## Workspace OS preparation gate

Before any Workspace OS rebase phase begins:

- ChatGPT, Claude Code, Codex, and user/controller role boundaries are reconciled in the authoritative workflow docs.
- `docs/tidy/STALENESS_AUDIT.md` has no unresolved high-priority workflow-boundary findings.
- The Workspace OS RFC has a single owner and does not duplicate `docs/AI_HANDOFF.md`, `docs/design.md`, or `docs/FUTURE_PLANS.md`.
