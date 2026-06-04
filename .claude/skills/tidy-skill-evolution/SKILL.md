---
name: tidy-skill-evolution
description: Review local Tidy learning candidates and propose skill or workflow doc improvements as a normal roadmap phase. Use when formalizing local observations. Never auto-promotes.
---

# tidy-skill-evolution

Trigger / use case: deciding which local observations to formalize into skill/doc improvements (typically before a handoff).

Read set (exact, only when explicitly asked):
- .tidy-ai/learning-queue.md - local, gitignored candidate queue (may be absent).
- the specific skill file(s) under review in .claude/skills/.
- docs/WORKFLOW.md Skill Surface (evolution loop) + docs/FUTURE_PLANS.md.

Do not read: product source, docs/PHASE_LOG.md, docs/SESSION_LOG/. Do not read the learning queue unless the user asks.

Allowed actions: review candidates; propose a skill/doc improvement as a roadmap phase.

Prohibited actions: auto-promoting any candidate; editing skills/docs directly outside an approved phase; committing raw observations.

Output contract:

    Candidates reviewed: [list or "none"]
    Proposed change: [skill/doc + what + why]
    Recommended phase: [version - title for FUTURE_PLANS, or "in-alpha correction if state=alpha"]
    Approval required: yes - no change is made until the user approves and a normal phase implements it.

Refusal rules: never mutate a skill automatically; never treat the learning queue as a source of truth.

Source of truth: docs/WORKFLOW.md Skill Surface (Skill Evolution Loop) + docs/FUTURE_PLANS.md.
