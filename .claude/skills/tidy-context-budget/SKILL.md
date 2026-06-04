---
name: tidy-context-budget
description: Run and interpret the on-demand Tidy AI context budget audit. Use when checking whether workflow or doc context overhead has grown, or before trimming docs.
---

# tidy-context-budget

Trigger / use case: checking whether workflow/doc context overhead has grown, or before trimming docs.

Read set (exact):
- docs/COMPACT_STRATEGY.md - Token Budget Targets and the startup read-set goals the audit measures against.
- scripts/ai-context-budget.ps1 - only if inspecting how the estimate is computed.

Do not read: product source, docs/PHASE_LOG.md, docs/SESSION_LOG/.

Allowed actions: run npm run budget:context; report the top bloat sources against the budget.

Prohibited actions: treating the characters/4 estimate as an exact tokenizer; adding the audit to session startup; calling any external service.

Output contract:

    Run: npm run budget:context
    Report: startup-doc total vs session-start budget; codebase-graph.json (separate, selective read); top task-routed and optional/historical bloat sources.
    Recommendation: what to trim, if anything.

Refusal rules: the audit is on-demand only; never run it as part of startup.

Source of truth: docs/COMPACT_STRATEGY.md (Token Budget Targets, Context Budget Audit).
