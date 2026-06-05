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

Opening sequence (emit outside code blocks, before Section 1, for any phase that opens a new alpha). Every scope output emits this exact opener template first, byte-identical, substituting only the angle-bracket placeholders:

    git switch -c phase/<version-slug>
    .\scripts\open-phase.ps1 -Version "<X.Y.Z>" -PhaseTitle "<Title>" -NextPhase "<next - title>"

Fixed-shape rules: <version-slug> is the dotted version plus a short kebab title (e.g. 1.8.1-opening-sequence-template); <X.Y.Z> is the bare dotted version; <Title> is the exact phase title; <next - title> matches the intended next Planned heading. Substitute -NextPhase "<next - title>" with -NoNextPhase when no planned phase remains, and append -AllowMissingNextPhase when this phase adds or renumbers docs/FUTURE_PLANS.md in the same patch. Then, in order: (3) point the user to the per-file opener commit commands open-phase.ps1 prints in its Next steps - never re-emit or re-type them (see Script-printed command rule below), (4) a Get-Content STATE.json confirm gate, then paste the Section 1 prompt to Codex. Never emit the open-phase command without the preceding branch-creation step. When the phase edits docs/FUTURE_PLANS.md, commit the opener first (it writes the In Progress pointer into that file) before Codex edits it, so the granular commits stay separable.

Script-printed command rule (single owner; AGENTS.md and tidy-validation-judge enforcement point here): never re-emit or re-type commands a Tidy script already prints in its Next steps. This is symmetric across open-phase.ps1 (the per-file opener commit commands) and promote.ps1 (the stable per-file commits and push). Always point the user to run the script's printed Next steps; re-typed copies drift from what the script actually prints. Fallback when the printout is gone (sanctioned): the no-re-emit rule assumes the script's Next steps are still on screen. When they have been cleared and cannot be recovered, do not improvise the commands from memory - reconstruct them from the script's fixed, version-only-parameterized Next-steps output:

    open-phase.ps1 Next steps (one commit per file; substitute <alphaVer>):
      .\scripts\commit.ps1 -Files "STATE.json"              -Message "chore(release): open <alphaVer>"
      .\scripts\commit.ps1 -Files "docs/VERSIONING.md"      -Message "chore(release): open <alphaVer>"
      .\scripts\commit.ps1 -Files "docs/AI_HANDOFF.md"      -Message "chore(release): open <alphaVer>"
      .\scripts\commit.ps1 -Files "package.json"            -Message "chore(release): open <alphaVer>"
      .\scripts\commit.ps1 -Files "docs/WORKFLOW.md"        -Message "chore(release): open <alphaVer>"
      (only if the phase edits the roadmap) .\scripts\commit.ps1 -Files "docs/FUTURE_PLANS.md" -Message "chore(release): mark <version> in progress"
      (only if the graph changed) .\scripts\commit.ps1 -Files "codebase-graph.json" -Message "chore(graph): refresh graph for <alphaVer>"

    promote.ps1 Next steps (one commit per file; substitute <alphaVer>/<stableVer>):
      .\scripts\commit.ps1 -Files "STATE.json"         -Message "chore(release): promote <alphaVer> to <stableVer>-stable"
      .\scripts\commit.ps1 -Files "docs/VERSIONING.md" -Message "chore(release): promote <alphaVer> to <stableVer>-stable"
      .\scripts\commit.ps1 -Files "docs/AI_HANDOFF.md" -Message "chore(release): promote <alphaVer> to <stableVer>-stable"
      .\scripts\commit.ps1 -Files "package.json"       -Message "chore(release): promote <alphaVer> to <stableVer>-stable"
      .\scripts\commit.ps1 -Files "docs/WORKFLOW.md"   -Message "chore(release): promote <alphaVer> to <stableVer>-stable"
      (only if the roadmap closed) .\scripts\commit.ps1 -Files "docs/FUTURE_PLANS.md" -Message "chore(release): close <stableVer> roadmap item"
      (only if the graph changed) .\scripts\commit.ps1 -Files "codebase-graph.json" -Message "chore(graph): refresh graph for <stableVer>-stable"
      git push origin master

If any doubt remains, open the script and read its "Next steps" Write-Host block directly rather than guessing. This fallback is reconstruction-only; the live printout, when present, always wins.

Reconcile before scoping: if the user references a phase, version, or work item that is not a heading in docs/FUTURE_PLANS.md, STOP and reconcile intent vs docs with the user before scoping anything; do not silently default to STATE.json.nextPhase, and do not fabricate a lost-state narrative. One phase per session: scope a single phase, then stop; never chain into the next phase. Prefer targeted reads (Grep / offset+limit on the needed block) over full-file reads of large docs, and never re-read a file already read in-session.

Self-check before emitting (all must pass): Section 1 and Section 2 are separate top-level code blocks; no triple-backtick fence appears inside the master prompt (use labels/indentation); Codex is told "Validation not run by Codex"; no git/commit/push/branch/validation commands inside the Codex prompt; surgical OLD/NEW pairs used where edit points are known; an alpha-opening prompt carries a PRECONDITION block; the opening sequence (branch -> open-phase -> opener commits -> STATE confirm) is emitted before Section 1; roadmap edits are placed in the master prompt, not handed to the user; no full master-prompt re-emit when only part changed.

Assistant Output Formatting Contract (canonical owner; docs/WORKFLOW.md points here): this skill is the single source of truth for how assistant Codex-prompt responses are shaped. Apply every rule:
- Keep markdown section headings outside code blocks.
- Section 1 - Master Prompt heading must stay outside the code block.
- Section 2 - Validation heading must stay outside the code block.
- The Codex prompt must be one text code block containing only the prompt intended for Codex.
- The validation block must be one PowerShell code block containing only validation commands.
- The alpha commit sequence must be one PowerShell code block containing all alpha commit commands, one command per line.
- Do not re-emit the stable promotion commit or push commands; promote.ps1 prints the exact per-file stable commit commands (including the conditional codebase-graph.json commit) and the final push, so instruct the user to run promote.ps1's printed Next steps instead.
- Never place "Section 1 - Master Prompt" or "Section 2 - Validation" inside copyable code blocks.
- Do not wrap both sections in one code block.
- Do not combine Codex prompt text and PowerShell commands in the same code block.
- The push command must be separate from commit command blocks.
- When providing a merge command, include the merge message inline with -m so Git does not open the default editor: git merge --no-ff phase/<version-slug> -m "merge: bring <version> <short phase name> into master"
- Code blocks must be copy-paste runnable for their target tool.
- Do not place explanatory prose, bullets, markdown headings, wrappers, or comments inside copyable command blocks unless they are commands the user should actually run.
- Use text for Codex prompt blocks.
- Use powershell for validation and command blocks.
- Codex implementation summaries must not include "Verified directly" or equivalent self-validation sections.
- Validation sections in Codex output must only contain commands for the user/controller to run.
- If Codex did not run validation, it must say "Validation not run by Codex."
- Codex must not claim validation/test/audit results unless the user provided them.

Refusal rules: if the change points cannot be pinned down, use the exploratory format (Goal/Constraints/Expected outcome/Codex instructions) rather than inventing OLD/NEW text.

Source of truth: docs/WORKFLOW.md Codex Prompt Format + docs/CODEX_RULES.md.
