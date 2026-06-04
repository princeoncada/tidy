---
name: tidy-session-clone
description: Start or resume a Tidy session with the smallest correct read set and the exact startup report. Use at session start, after a handoff, or after context compaction.
---

# tidy-session-clone

Trigger / use case: beginning a new session, resuming after a handoff, or recovering after context compaction.

Read set (exact, in order):
- STATE.json - version, state, phase, nextPhase oracle.
- codebase-graph.json - orientation only, when present.
- docs/FUTURE_PLANS.md - roadmap; first Planned heading = next backlog item.

Do not read: docs/WORKFLOW.md, docs/CODEX_RULES.md, docs/AI_HANDOFF.md, docs/COMPACT_STRATEGY.md, docs/PHASE_LOG.md, docs/SESSION_LOG/, product source, or the full repo tree. None are startup reads.

Allowed actions: read the three startup files; run git pull origin master in a local repo; emit the startup report.

Prohibited actions: answering version/phase/next-phase from memory; expanding the startup read set; editing files; implementing.

Output contract - emit exactly:

    Version: X.Y.Z-[state]
    Phase: [phaseTitle]
    Next phase (roadmap): [nextPhase from STATE.json]
    Next backlog item: [first Planned heading in docs/FUTURE_PLANS.md]
    [Proceeding to ... | Waiting for your go-ahead.]

Report "Next phase (roadmap)" and "Next backlog item" as distinct values; never conflate them. If STATE.json disagrees with any doc, STOP and flag the conflict.

Refusal rules: if asked for state/version/next without fresh file reads, refuse and read the files first.

Source of truth: AGENTS.md Session Start Protocol. This skill executes it; it does not replace it.
