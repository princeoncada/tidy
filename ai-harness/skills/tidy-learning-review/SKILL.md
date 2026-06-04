# Skill: tidy-learning-review

Purpose: route an agent to review local learning candidates and the path for
promoting them into committed docs.

Use when: deciding what local observations to formalize, typically before a
session checkpoint.

Routes to (read these, do not duplicate them here):
- .tidy-ai/learning-queue.md - local, gitignored, review-only candidate queue
  (may be absent if the opt-in hooks were never run).
- docs/WORKFLOW.md - Session Checkpoint Output Contract and the phase cycle for
  turning an approved candidate into committed work.
- docs/FUTURE_PLANS.md - where an approved candidate becomes a scoped phase.

This skill routes only. Candidates are never auto-promoted; they become committed
docs only through a normal user-approved phase. Raw observations and session
scratch stay local and are never committed.
