# Skill: tidy-validation-followup

Purpose: route an agent to the correct next action after validation output is
provided.

Use when: the user or controller has pasted validation or status evidence.

Routes to (read these, do not duplicate them here):
- docs/WORKFLOW.md - Validation-Gated Assistant Responses and Post-Validation
  Workflow (commit-before-fix, alpha commit sequence, closeout packet).
- docs/CODEX_RULES.md - validation boundary and commit discipline.

This skill routes only. Validation is user or controller-run; the assistant
never runs validation or claims results that were not provided.
