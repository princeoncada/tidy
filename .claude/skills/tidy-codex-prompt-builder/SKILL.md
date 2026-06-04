---
name: tidy-codex-prompt-builder
description: Scope a Tidy implementation phase and produce the Codex prompt (Graph Routing Summary, Section 1 Master Prompt, Section 2 Validation). Use when writing or reviewing a Codex prompt for a phase.
---

# tidy-codex-prompt-builder

Trigger / use case: "scope it out", or any request to write or review a Codex implementation prompt.

Read set (exact):
- docs/CONTEXT_INDEX.md - choose the smallest correct read set first.
- docs/WORKFLOW.md - Codex Prompt Format, Prompt Format Selection, Assistant Output Formatting Contract, Graph Routing Usage Contract.
- docs/CODEX_RULES.md - scope control, required tests, validation boundary, commit discipline.
- docs/AI_HANDOFF.md - current product state, invariants, risks.
- codebase-graph.json + 2-3 graph-selected source files for source phases.

Do not read: unrelated product source, docs/PHASE_LOG.md, docs/SESSION_LOG/, the full repo tree.

Allowed actions: scope the phase; emit Graph Routing Summary + Section 1 + Section 2.

Prohibited actions: giving Codex git/commit/push/branch commands; telling Codex to run validation; emitting nested triple-backtick fences inside the master prompt; broad-scan instructions; scoping source edits outside the phase.

Output contract - in this order:
0. Local Evidence Packet gate (outside code blocks): if the phase is source-heavy or local-sensitive and the packet output has not already been provided, emit the Local Evidence Packet as one powershell code block (git status --short; git log --oneline -5; Get-Content STATE.json; npm run graph:codebase; git diff --stat) and wait for the pasted output before scoping. This is pre-scope evidence, distinct from the Section 2 graph refresh; skip only for docs-only phases scoped purely from remote state. Source of truth: AGENTS.md ChatGPT Architect Mode + docs/WORKFLOW.md.
1. Graph Routing Summary (outside code blocks): task category, graph-selected files + why, intentionally skipped, whether direct reads are still required.
2. Section 1 - Master Prompt heading, then ONE text code block: opening + version lines, READ THESE FILES FIRST, CURRENT PROJECT STATE, IMPLEMENTATION REQUIREMENTS (CREATE/MODIFY, exact OLD/NEW for known edits), SAFETY CONSTRAINTS, STOP AND SUMMARIZE.
3. Section 2 - Validation heading, then ONE powershell code block with only validation commands.

Self-check before emitting (all must pass): Section 1 and Section 2 are separate top-level code blocks; no triple-backtick fence appears inside the master prompt (use labels/indentation); Codex is told "Validation not run by Codex"; no git/commit/push/branch/validation commands inside the Codex prompt; surgical OLD/NEW pairs used where edit points are known.

Refusal rules: if the change points cannot be pinned down, use the exploratory format (Goal/Constraints/Expected outcome/Codex instructions) rather than inventing OLD/NEW text.

Source of truth: docs/WORKFLOW.md Codex Prompt Format + docs/CODEX_RULES.md.
