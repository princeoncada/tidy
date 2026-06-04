# Skill: tidy-debug-attempt

Purpose: route an agent to the debugging attempt discipline before any fix.

Use when: a validation check or test fails and a fix is being considered.

Routes to (read these, do not duplicate them here):
- docs/CODEX_RULES.md - Debugging Attempt Discipline (failure classification and
  the before-fix attempt block).
- the failing test or check file and the smallest suspected implementation file
  set.

This skill routes only. Classify the failure and state the before-fix attempt
block from docs/CODEX_RULES.md before changing any file.
