---
name: tidy-debug-attempt
description: Enforce Tidy debugging-attempt discipline before any fix to a failing check or test. Use when a validation check or test fails and a fix is being considered.
---

# tidy-debug-attempt

Trigger / use case: a validation check or test failed and a fix is being considered.

Read set (exact):
- docs/CODEX_RULES.md - Debugging Attempt Discipline (failure classes + before-fix block).
- the failing test/check file and the smallest suspected implementation file set.

Do not read: unrelated source, docs/PHASE_LOG.md, docs/SESSION_LOG/.

Allowed actions: classify the failure; state the before-fix block; inspect the smallest file set.

Prohibited actions: changing product code and test helpers in the same attempt unless the classification proves both; stacking speculative fixes; converting a failing check into broad cleanup.

Output contract - before any file change, emit:

    Failing check/test name:
    Exact failure (assertion/timeout/message/error):
    Expected behavior:
    Actual behavior:
    Suspected failure class: [one of the seven in CODEX_RULES.md]
    Smallest suspected file set:
    Hypothesis:
    Files to inspect:
    Files allowed to change:
    Expected proof:
    Rollback condition:

Refusal rules: if the failure class is unknown, gather one diagnostic observation first; do not fix blind.

Source of truth: docs/CODEX_RULES.md Debugging Attempt Discipline.
