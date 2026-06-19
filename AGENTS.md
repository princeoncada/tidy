# AI Agent Instructions

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This project uses newer framework versions with breaking changes. Follow existing repo patterns first. If changing Next.js app APIs and `node_modules/next/dist/docs/` exists, read the relevant local guide and heed deprecations.
<!-- END:nextjs-agent-rules -->

## Session Start Protocol

At the start of every session, before other docs or edits:

0. In a local repo, run `git pull origin master`. If git is unavailable, report why and continue with remote/direct reads.
1. Read `STATE.json` first. It is the version, state, phase, and next-phase oracle.
2. Read `codebase-graph.json` when present for orientation only. If missing, stale, invalid, or version-mismatched, report that and use direct reads.
3. Read `docs/FUTURE_PLANS.md` fresh for the forward roadmap and first Planned item.
4. Emit the Startup Report exactly.
5. With live opening-message scope, proceed directly to Codex prompts. Without live scope, wait. A resumed minimal handoff is orientation, not authorization; after handoff/resume emit the report and wait for explicit go-ahead.

Never answer version, phase, or "what's next" from memory. Completed-version history is owned by `docs/VERSIONING.md` `## Version History`; FUTURE_PLANS owns the forward roadmap.

## Startup Report Format

    Version: X.Y.Z-[state]
    Phase: [phaseTitle]
    Next phase (roadmap): [STATE.json nextPhase]
    Next backlog item: [first Planned heading in docs/FUTURE_PLANS.md]
    [one of:]
    Proceeding to Codex prompts for [scope].
    Waiting for your go-ahead.

"Next phase (roadmap)" and "Next backlog item" are distinct and must not be conflated.

## Drift Guardrails

- `STATE.json` is the single owner of version/state/phase identity. Stop on disagreement; never guess or silently reconcile.
- When state is stable, the same phase must not remain In Progress or first Planned. `STATE.json.nextPhase` must equal the first Planned heading unless the documented series-boundary exception applies.
- A user-referenced phase/version/work item must have one roadmap home: a Planned heading or explicit Potential Next Direction. If absent, stop and reconcile intent before scoping.
- Verify the current conversation before claiming continuity or handoff loss; never invent a lost-state narrative.
- `scripts/validate.ps1` gates all five version locations. Version changes are script-owned.
- The graph is routing-only. Do not treat it as source of truth or run graph audit at startup.
- For implementation, directly read `docs/AI_HANDOFF.md`, `docs/CODEX_RULES.md`, and the smallest relevant source set after graph routing.

## ChatGPT Reviewer Mode

Claude Code owns local architecture, scoping, planning, validation, and Codex prompts. ChatGPT reviews pushed GitHub state plus pasted evidence; it cannot see local uncommitted work, branch-only files, local diffs/status, validation output, or generated graph changes.

Source-heavy, branch-local, or graph-sensitive ChatGPT review requires a Local Evidence Packet:

    git status --short
    git log --oneline -5
    Get-Content STATE.json
    npm run graph:codebase
    git diff --stat

Optional targeted diffs or doc searches may be added. A local Claude session self-gathers this evidence before scoping; emit-and-wait is only for ChatGPT reviewer context or sessions without local access. If evidence is absent, state that review is pushed-remote-only. Never imply connector reads include local state.

## Routing and Graph Use

Normal startup reads only STATE.json, codebase-graph.json when present, and FUTURE_PLANS. During task work:

- Use `docs/CONTEXT_INDEX.md` to select the smallest route.
- Read `docs/WORKFLOW.md` only for prompt/process or post-validation work.
- Read `docs/CODEX_RULES.md` for implementation, testing, validation boundaries, and commit discipline.
- Read `docs/AI_HANDOFF.md` for current product invariants and risks.
- Use `docs/PHASE_LOG.md` only for historical investigation.
- For script/tooling scope, inspect `scripts/` for an existing implementation first.
- Do not broadly scan unrelated source or generated Prisma output.

Implementation-scoping responses include a concise Graph Routing Summary: task category, selected files and why, intentionally skipped files, and whether direct reads remain required. If the graph is unhelpful, say so and use direct reads. Detailed prompt formatting is owned by `.claude/skills/tidy-codex-prompt-builder/SKILL.md`.

## Session Continuity

Normal continuation uses `tidy-minimal-handoff`, not SESSION_LOG. Offer it when a session runs long, a phase is promoted, or the user stops/switches. SESSION_LOG is optional historical audit for retrospectives or risky operations. `docs/WORKFLOW.md` owns both contracts.

Continuity must be recoverable from STATE.json + FUTURE_PLANS + AI_HANDOFF + the minimal handoff. One phase per session; after promotion, hand off and continue in a fresh session.

## Working Posture

- Rails are strict: implementation gate, version scripts, validation boundary, scope control, and commit discipline.
- Surface conflicts and risks immediately.
- Use best judgment on non-material ambiguity; ask only for choices the user must make.
- Name out-of-scope issues and their location; do not silently fix them.
- After each step, state what was checked and the next action.

## Roles and Implementation Gate

Claude Code scopes/plans/validates and writes Codex prompts. Codex implements the scoped change. ChatGPT reviews.

Claude Code may implement directly only with this exact user-provided phrase:

    I AUTHORIZE CLAUDE CODE TO IMPLEMENT - [reason]

Without it, Claude writes the two-section Codex prompt defined in WORKFLOW. The phrase is a user-initiated fallback when Codex cannot finish; Claude never suggests it. Even when authorized, Claude never commits, pushes, creates branches, or runs `npm run test:ci`.

When `STATE.json.state = alpha`, corrections extend the active phase without a version bump or full re-scope. Stable fixes open a new phase.

## Codex Validation Boundary

Codex edits only the scoped files and does not run validation, npm, build, graph audit, git, commit, push, or branch commands. Validation is user/controller-run. Codex reports results only when the user supplied them and must say "Validation not run by Codex" otherwise.

Behavior changes require matching tests in the same branch. Before implementation, identify happy/common/edge cases and unit/E2E needs. `docs/CODEX_RULES.md` owns commands, manual regressions, scope control, and definition of done.

## Command Vocabulary

- "scope it out": emit the full Codex prompt and Section 2 validation via `tidy-codex-prompt-builder`.
- "what's next": read FUTURE_PLANS fresh and report its first Planned item; distinguish STATE.nextPhase.
- "session start" / "continue": run Session Start Protocol.
- "handoff" / "continue elsewhere": run `tidy-minimal-handoff`.
- "session checkpoint": emit the optional audit contract from WORKFLOW.
- Failed validation: classify it and provide the smallest fix prompt immediately; never ask for direct-implementation authorization.

## Scope, Commits, and Output

- Keep diffs focused; do not refactor unrelated code, rename public contracts, edit generated Prisma output, or change lockfiles/packages/versions unless scoped.
- `docs/WORKFLOW.md` owns branch lifecycle and closeout. `docs/CODEX_RULES.md` owns implementation and commit discipline.
- The user runs per-file `commit.ps1` commands. Commit-before-fix is mandatory for meaningful alpha work. Never add AI co-author trailers.
- Prompt/output formatting is owned by `tidy-codex-prompt-builder`: headings outside fences, prompt and PowerShell blocks separate, copy-safe commands, and no re-emission of script-printed Next steps.

## Behavior and Documentation

Unless explicitly changed, preserve optimistic/rollback behavior, query keys/cache shapes, projection rules, local-only drag hover and committed-write invariants, ordering semantics, Supabase user scoping, and protected procedures.

Update AI_HANDOFF when invariants, data flow, or risks change. Update FUTURE_PLANS only for scoped roadmap work or discovered follow-ups. Prefer concise pointers to live owners over duplicated guidance.
