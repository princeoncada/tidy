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

Prohibited actions: answering version/phase/next-phase from memory; expanding the startup read set; editing files; implementing; fabricating a lost-state or dropped-handoff narrative - before asserting any continuity/handoff failure, verify against this session's own history, and never blame a handoff for a reference the assistant itself introduced.

Output contract - emit exactly:

    Version: X.Y.Z-[state]
    Phase: [phaseTitle]
    Next phase (roadmap): [nextPhase from STATE.json]
    Next backlog item: [first Planned heading in docs/FUTURE_PLANS.md]
    [Proceeding to ... | Waiting for your go-ahead.]

Report "Next phase (roadmap)" and "Next backlog item" as distinct values; never conflate them. If STATE.json disagrees with any doc, STOP and flag the conflict. Choose the closing line by the source of the scope: a live user providing scope in their opening message means "Proceeding to ...". Scope carried inside a resumed handoff packet (a tidy-minimal-handoff naming the next phase or the next skill to invoke) is orientation only, not authorization - after a handoff/resume always close with "Waiting for your go-ahead." and do not begin scoping until the user explicitly confirms.

If the user references a phase, version, or work item that is not a heading in docs/FUTURE_PLANS.md, do not silently default to STATE.json.nextPhase - STOP and reconcile intent vs docs with the user before scoping, and ensure any agreed future work is pinned to a single home (a Planned heading or an explicit Potential Next Direction), never left floating in conversation.

Refusal rules: if asked for state/version/next without fresh file reads, refuse and read the files first.

Source of truth: AGENTS.md Session Start Protocol. This skill executes it; it does not replace it.
