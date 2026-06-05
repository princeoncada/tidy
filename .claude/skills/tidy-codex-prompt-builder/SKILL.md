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

Prohibited actions: giving Codex git/commit/push/branch commands; telling Codex to run validation; emitting nested triple-backtick fences inside the master prompt; broad-scan instructions; scoping source edits outside the phase; instructing the user to hand-edit docs/FUTURE_PLANS.md or any roadmap doc - roadmap-capture and reconciliation edits go into the Codex master prompt as ordinary MODIFY items; re-emitting a full master prompt to change part of an already-delivered prompt - emit only the changed items as a labeled delta or route the fix through the in-alpha correction path, and re-emit a full prompt only if the phase identity itself changed; chaining into a second phase in the same session.

Output contract - in this order:
0. Local Evidence gate (outside code blocks): if the phase is source-heavy or local-sensitive, the Local Evidence Packet's evidence must exist before scoping. A LOCAL Claude Code session self-gathers it with its own tools (run git status --short, git log --oneline -5, read STATE.json, run npm run graph:codebase, run git diff --stat) and then scopes - it does not emit the packet for the user to paste back. Reserve the emit-one-powershell-block-and-wait form for ChatGPT architect scoping or a session without local access. This is pre-scope evidence, distinct from the Section 2 graph refresh; skip only for docs-only phases scoped purely from remote state. Source of truth: AGENTS.md ChatGPT Architect Mode + docs/WORKFLOW.md.
1. Graph Routing Summary (outside code blocks): task category, graph-selected files + why, intentionally skipped, whether direct reads are still required.
2. Section 1 - Master Prompt heading, then ONE text code block: opening + version lines, READ THESE FILES FIRST, CURRENT PROJECT STATE, IMPLEMENTATION REQUIREMENTS (CREATE/MODIFY, exact OLD/NEW for known edits), SAFETY CONSTRAINTS, STOP AND SUMMARIZE. When the phase is opened with open-phase.ps1 -AllowMissingNextPhase, add an EXPECTED DRIFT - DO NOT HALT preamble right after CURRENT PROJECT STATE that names the exact transient STATE.json-vs-FUTURE_PLANS mismatch and the requirement number that reconciles it, so Codex's startup Drift Guardrail does not STOP on intended roadmap drift. Every master prompt that opens an alpha phase must also include a PRECONDITION block immediately after the opening version lines: it states the opener has already set this alpha version, tells Codex to proceed if STATE.json matches the header version, and to STOP and report "run the opener first" if STATE.json still shows the prior stable version - rather than treating the header as drift to reconcile or editing versioning files to force a match.
3. Section 2 - Validation heading, then ONE powershell code block with only validation commands. Lead Section 2 with npm run graph:codebase only when the phase changes the source file set (add/remove/rename) or any top-level exported symbol or import; open-phase.ps1 already refreshes and version-syncs the committed graph when the alpha opens, and since 1.6.5 the generator captures only top-level exports, so a docs/skills or body-only phase that changes no source exports or imports does not need a Section 2 graph refresh. validate.ps1 follows in either case and regenerates the graph to gate freshness.

Opening sequence (emit outside code blocks, before Section 1, for any phase that opens a new alpha): emit, in order, (1) git switch -c phase/<version-slug> from clean stable master, (2) the open-phase.ps1 command with -NextPhase or -NoNextPhase, (3) run the per-file opener commit commands open-phase prints, (4) a Get-Content STATE.json confirm gate, then paste the Section 1 prompt to Codex. Never emit the open-phase command without the preceding branch-creation step. When the phase edits docs/FUTURE_PLANS.md, the opener must be committed before Codex edits that file, because open-phase writes the In Progress pointer into it.

Reconcile before scoping: if the user references a phase, version, or work item that is not a heading in docs/FUTURE_PLANS.md, STOP and reconcile intent vs docs with the user before scoping anything; do not silently default to STATE.json.nextPhase, and do not fabricate a lost-state narrative. One phase per session: scope a single phase, then stop; never chain into the next phase. Prefer targeted reads (Grep / offset+limit on the needed block) over full-file reads of large docs, and never re-read a file already read in-session.

Self-check before emitting (all must pass): Section 1 and Section 2 are separate top-level code blocks; no triple-backtick fence appears inside the master prompt (use labels/indentation); Codex is told "Validation not run by Codex"; no git/commit/push/branch/validation commands inside the Codex prompt; surgical OLD/NEW pairs used where edit points are known; an alpha-opening prompt carries a PRECONDITION block; the opening sequence (branch -> open-phase -> opener commits -> STATE confirm) is emitted before Section 1; roadmap edits are placed in the master prompt, not handed to the user; no full master-prompt re-emit when only part changed.

Refusal rules: if the change points cannot be pinned down, use the exploratory format (Goal/Constraints/Expected outcome/Codex instructions) rather than inventing OLD/NEW text.

Source of truth: docs/WORKFLOW.md Codex Prompt Format + docs/CODEX_RULES.md.
