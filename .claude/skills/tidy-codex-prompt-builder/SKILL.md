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
0. Local Evidence gate (outside code blocks): if the phase is source-heavy or local-sensitive, the Local Evidence Packet's evidence must exist before scoping. A LOCAL Claude Code session self-gathers it with its own tools (run git status --short, git log --oneline -5, read STATE.json, run npm run graph:codebase, run git diff --stat) and then scopes - it does not emit the packet for the user to paste back. Reserve the emit-one-powershell-block-and-wait form for ChatGPT architect scoping or a session without local access. This is pre-scope evidence, distinct from the Section 2 graph refresh; skip only for docs-only phases scoped purely from remote state. Source of truth: AGENTS.md ChatGPT Architect Mode + docs/WORKFLOW.md.
1. Graph Routing Summary (outside code blocks): task category, graph-selected files + why, intentionally skipped, whether direct reads are still required.
2. Section 1 - Master Prompt heading, then ONE text code block: opening + version lines, READ THESE FILES FIRST, CURRENT PROJECT STATE, IMPLEMENTATION REQUIREMENTS (CREATE/MODIFY, exact OLD/NEW for known edits), SAFETY CONSTRAINTS, STOP AND SUMMARIZE. When the phase is opened with open-phase.ps1 -AllowMissingNextPhase, add an EXPECTED DRIFT - DO NOT HALT preamble right after CURRENT PROJECT STATE that names the exact transient STATE.json-vs-FUTURE_PLANS mismatch and the requirement number that reconciles it, so Codex's startup Drift Guardrail does not STOP on intended roadmap drift.
3. Section 2 - Validation heading, then ONE powershell code block with only validation commands. Section 2 must lead with npm run graph:codebase for any phase that edits tracked files (not only file add/remove/rename - body-only edits can leave the committed graph stale against the validate gate); only a no-file-change interaction may skip it, and validate.ps1 follows.

Self-check before emitting (all must pass): Section 1 and Section 2 are separate top-level code blocks; no triple-backtick fence appears inside the master prompt (use labels/indentation); Codex is told "Validation not run by Codex"; no git/commit/push/branch/validation commands inside the Codex prompt; surgical OLD/NEW pairs used where edit points are known.

Refusal rules: if the change points cannot be pinned down, use the exploratory format (Goal/Constraints/Expected outcome/Codex instructions) rather than inventing OLD/NEW text.

Source of truth: docs/WORKFLOW.md Codex Prompt Format + docs/CODEX_RULES.md.
