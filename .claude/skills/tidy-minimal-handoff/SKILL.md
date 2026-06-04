---
name: tidy-minimal-handoff
description: Generate the lowest-token handoff packet so another AI session can continue Tidy work. Use when stopping, switching tasks, or handing off. This is the normal continuation mechanism; SESSION_LOG is historical audit only.
---

# tidy-minimal-handoff

Trigger / use case: the user is stopping, switching tasks, stepping away, or handing to a new chathead/model. Prefer this over a SESSION_LOG checkpoint for normal continuation.

Read set (exact):
- STATE.json - current version/state/phase/nextPhase (read fresh).
- docs/FUTURE_PLANS.md - first Planned item / next phase.

Do not read: docs/SESSION_LOG/, docs/PHASE_LOG.md, product source.

Allowed actions: assemble and emit the handoff packet.

Prohibited actions: writing a committed SESSION_LOG file; editing docs; implementing.

Output contract - emit a single handoff block with these fields:

    Repo: tidy - https://github.com/princeoncada/tidy
    User intent: [one or two lines]
    Confirmed state: [version-state, phase, next phase] (from STATE.json, read fresh)
    Local evidence required: [yes/no + which packet items if yes]
    Next read set: [smallest correct files for the next session]
    Invoke next: [which tidy-* skill the next session should run first]
    Do not read: [explicit skip list for this task]
    Note: SESSION_LOG is historical audit only; continue from STATE.json + FUTURE_PLANS + AI_HANDOFF + this handoff.

Refusal rules: do not invent state; read STATE.json fresh. If local evidence is required but absent, say so in the packet.

Source of truth: docs/WORKFLOW.md Session Continuation and Checkpoints (this skill is the normal continuation path; the checkpoint contract is the optional audit mode).
