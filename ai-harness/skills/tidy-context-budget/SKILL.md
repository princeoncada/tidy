# Skill: tidy-context-budget

Purpose: route an agent to the on-demand AI context budget audit and how to read
its output.

Use when: checking whether workflow or doc context overhead has grown, or before
trimming docs.

Routes to (read these, do not duplicate them here):
- scripts/ai-context-budget.ps1 - the on-demand audit (run: npm run budget:context).
- docs/COMPACT_STRATEGY.md - Token Budget Targets and the startup read-set goals
  the audit measures against.

This skill routes only. The audit is on-demand, uses a characters/4 estimate, is
never part of session startup, changes no product behavior, and calls no external
service.
