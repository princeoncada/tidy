# Versioning

## Version Format

```
X.Y.Z-[state]
```

- **X** - Major: architectural shift (new persistence layer, framework upgrade, full system replacement)
- **Y** - Minor: significant feature or phase completion
- **Z** - Patch: bug fix, doc correction, minor tweak
- **State**: `alpha` (implemented, not validated) | `stable` (fully validated, committed to master)

## Five Versioning Locations

Every version bump must update **all five** in the same commit:

1. `STATE.json` - `version` + `state` fields (machine-readable oracle; read first every session)
2. `docs/VERSIONING.md` - current version state + rules (this file)
3. `docs/AI_HANDOFF.md` - version comment at top
4. `package.json` - `version` field
5. `docs/WORKFLOW.md` - version comment at top

Use `.\scripts\open-phase.ps1` to open a new `-alpha` phase across all five locations automatically.
Use `.\scripts\promote.ps1` to promote `-alpha` -> `-stable` across all five locations automatically.

## Doc Continuity Model

Every fact that appears in more than one doc has exactly ONE owner. Other docs must
either reference the owner (Point), be synced from it by a script (Sync), or be
checked against it by `validate.ps1` (Gate). Never hand-copy an owned fact into a
new place - that is how drift starts.

| Fact | Owner | Where it also appears | Kept in sync by |
|------|-------|-----------------------|-----------------|
| Version + state string | `STATE.json` (`version`, `state`) | VERSIONING (current state), AI_HANDOFF (comment + prose), package.json, WORKFLOW (comment) | Sync: `open-phase.ps1` (alpha) + `promote.ps1` (stable) + Gate: `validate.ps1` |
| Phase identity (number + title) | `STATE.json` (`phase`, `phaseTitle`) | VERSIONING (Current State), AI_HANDOFF (Current Phase) | Gate: `validate.ps1` checks current VERSIONING and AI_HANDOFF copies against STATE.json |
| Next phase | `STATE.json` (`nextPhase`) | VERSIONING (Next phase line), AI_HANDOFF (Next line) | Sync: `open-phase.ps1` (alpha) + `promote.ps1` (stable) + Gate: `validate.ps1` checks copies and stable roadmap agreement |
| Next backlog item | `docs/FUTURE_PLANS.md` (first Planned) | reported at startup; compared with STATE.json nextPhase when stable | Point: read fresh each session + Gate: `validate.ps1` |
| Roadmap (version-sequenced) | `docs/FUTURE_PLANS.md` (Planned) | startup reads it; VERSIONING holds version rules + current state only | Point: FUTURE_PLANS is the single roadmap owner |
| Roadmap closeout | `docs/FUTURE_PLANS.md` (In Progress / Planned) | promotion workflow | Sync: `promote.ps1` closes the promoted roadmap item + Gate: `validate.ps1` catches stale phase/backlog drift |
| Completed-version history | `docs/VERSIONING.md` (`## Version History` table) | FUTURE_PLANS Completed points to it | Sync: `promote.ps1` writes the row + Gate: `validate.ps1` gates it |
| Session state snapshot | `STATE.json` + `docs/FUTURE_PLANS.md` | the chathead opener | Point: opener tells the AI to read them; it must NOT embed a snapshot |
| Project rules / entrypoint | `AGENTS.md` | `CLAUDE.md` (imports it via `@AGENTS.md`) | Point: CLAUDE.md must stay a one-line import and never restate rules |

Rules:
- Adding a new copy of an owned fact is drift. Point to the owner instead.
- `CLAUDE.md` is a thin `@AGENTS.md` import - never add rule text directly to it.
- The roadmap lives only in `docs/FUTURE_PLANS.md` (Planned). Do not keep a second
  roadmap table in VERSIONING.md.
- Completed-version history lives only in the `docs/VERSIONING.md`
  `## Version History` table. FUTURE_PLANS Completed points to that table and
  does not duplicate released-version rows.
- FUTURE_PLANS remains the single owner of the forward roadmap. Promotion may
  close the promoted roadmap item there, but FUTURE_PLANS is roadmap state, not
  a sixth versioning location.
- When state is stable, `STATE.json.nextPhase` must equal the first Planned
  heading in `docs/FUTURE_PLANS.md`. `validate.ps1` gates this agreement, and
  `promote.ps1` blocks promotion if closeout would leave drift.
- `STATE.json` owns `nextPhase`; `docs/FUTURE_PLANS.md` owns the roadmap and
  first Planned heading. When stable, they must agree. `validate.ps1` gates the
  agreement, while `open-phase.ps1` and `promote.ps1` enforce it during phase
  transitions. FUTURE_PLANS remains roadmap state, not a sixth versioning
  location.
- When opening alpha, `open-phase.ps1` requires `STATE.json.nextPhase` to exist
  in Planned unless `-AllowMissingNextPhase` is used for a scoped roadmap rewrite
  patch that adds or renumbers FUTURE_PLANS before validation.
- `STATE.json.seriesComplete` marks that a numbered product arc has concluded
  (set `true` at 2.0.9 for the 2.0 local-first arc). As of 2.2.3 it no longer
  blanket-disables the nextPhase-ordering gate in `validate.ps1` and `promote.ps1`:
  that gate now runs whenever `nextPhase` is set and names a real Planned heading.
  `seriesComplete` only relaxes the gate for a genuine series boundary - when
  `nextPhase` names a future direction not yet broken out as a Planned heading. A
  new minor opened after a completed arc therefore stays drift-checked even while
  `seriesComplete` remains `true`.
- Prompt format safety is a workflow invariant. Docs that define prompt
  templates must avoid nested fenced code blocks. Workflow prompts should be
  emitted as separate top-level sections: Section 1 master prompt, Section 2
  validation, and optional commit/promotion blocks. When a section itself is
  fenced, examples inside it must be unfenced or indented.
- Repo state questions are answered from pushed GitHub state or local repo state
  depending on execution context. ChatGPT reviewer mode uses pushed GitHub
  state plus pasted local evidence; local-only facts are not visible to ChatGPT
  until pasted or pushed. The Local Evidence Packet is the bridge for local
  ChromaDB, graph output, git diff/status, and validation output. This does not
  change `STATE.json` ownership or `docs/FUTURE_PLANS.md` ownership, and prompt
  format safety still applies when documenting the Local Evidence Packet.
- `docs/PHASE_LOG.md` is historical traceability for pre-versioning work and old
  checkpoint evidence. It is not an active workflow surface for new versioned
  phases.
- The chathead opener instructs reading `STATE.json` + `docs/FUTURE_PLANS.md`; it
  must never embed a "current state" or "next work" snapshot.

## Rules

**Bug Fix Rule**: Any bug discovered after a stable release always opens a `Z+1` patch. Never modify a stable release in place. The implementation prompt must bump all five locations to `X.Y.(Z+1)-alpha`.

**Version Ordering Rule**: Versions must be monotonically increasing and reflect actual implementation order, not planned order. If a phase is built out of sequence, assign the next available `Y.Z` after the last stable release - never fill gaps or retrofit.

**Planned Renumber Rule**: Planned (not-yet-built) versions in `docs/FUTURE_PLANS.md` may be renumbered to stay monotonic. Inserting a new minor or major pushes the later planned numbers back (e.g. inserting 1.2.0 pushed Phase 3 Completion 1.2.0 -> 1.3.0). Patches (Z) may ship under the current minor before the next X/Y. Renumber only planned items - never a released version.

**Alpha Rule**: A version stays `-alpha` until `npm run test:ci` passes clean. Do not promote to stable until the full validation suite is green.

---

## Current State

- **Current version:** 3.1.0
- **Current phase:** 3.1.0 - Sync Latency Measurement Spike
- **Next phase:** 3.1.1 - Sync Latency Fix

---

## Pre-Versioning Baseline

Everything below was built before formal versioning was introduced (pre-1.0.0). Documented for traceability.

### Core Application Bootstrap (pre-1.0.0)

Tidy was bootstrapped as a Next.js 16 / React 19 / TypeScript strict productivity app:

- **Auth**: Supabase email/password + OTP; proxy-guarded `/dashboard` route (`proxy.ts`)
- **API**: tRPC 11 with protected procedures, Prisma 7 + PostgreSQL via `@prisma/adapter-pg`
- **Client state**: TanStack Query 5, `lib/dashboard-cache.ts` centralized cache helpers, `hooks/useOptimisticSync.ts` module-level queue
- **UI**: dnd-kit drag-and-drop, shadcn/radix, Tailwind v4, Framer Motion
- **Features**: Lists, items (with completion + ordering), custom views, tag system (ALL/ANY match modes), view reordering
- **Docs**: `docs/ai/` system with 14 feature reference docs (deprecated in v1.0.0; content consolidated into `docs/AI_HANDOFF.md` and `docs/CODEX_RULES.md`)

### Phase 1: Dexie Foundation (pre-1.0.0) - COMPLETE

Branch merged to master. Added local-first persistence layer:

- Dexie v4 local database + schema (`lib/local/db.ts`)
- Outbox operation types and metadata repository helpers
- Sync status model foundation
- No server sync triggered (intentional: foundation only, runtime behavior unchanged)

Phase log: `docs/PHASE_LOG.md` (Phase 1 section)

### Phase 2: Outbox Sync Queue (pre-1.0.0) - COMPLETE

Branch ready for merge review at time of versioning introduction. Added durable write queue infrastructure:

- `OutboxOperation` model with coalescing rules
- Replay client contract and sync endpoint scaffolding
- Sync status surface in UI
- Runtime behavior intentionally unchanged (auto-sync deferred to Phase 4)

Phase log: `docs/PHASE_LOG.md` (Phase 2 section)

### Phase 3: View Filter Hardening (pre-1.0.0) - IN PROGRESS

Active branch: `checkpoint/fix-cross-view-list-moves`. Fixing projection consistency for custom views (ANY-mode list visibility, cross-view list moves, tag relation consistency):

| Checkpoint | Branch | Status |
|---|---|---|
| 1: fix-view-list-projection | `checkpoint/fix-view-list-projection` | Done |
| 2: fix-tag-relation-consistency | `checkpoint/fix-tag-relation-consistency` | Done |
| 3: fix-cross-view-list-moves | `checkpoint/fix-cross-view-list-moves` | Active |
| 4-6 | TBD | Planned |

Phase log: `docs/PHASE_LOG.md` (Phase 3 section)

---

## Version History

| Version | Date | Title | Type | Product Impact | Runtime Target | Validation Target | Files | Notes |
|---|---|---|---|---|---|---|---|---|
| 1.0.0 | 2026-05-28 | AI Workflow Foundation | docs/workflow | none - internal AI workflow infrastructure | STATE.json-backed AI workflow and release scripts | not recorded | STATE.json, AGENTS.md, docs/*, scripts/*, requirements.txt | Introduced the AI workflow, versioning, validation, promotion, and handoff infrastructure. |
| 1.0.1 | 2026-05-28 | AGENTS.md Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released AGENTS.md Hardening. |
| 1.0.2 | 2026-05-28 | Commit Automation and Prompt Format Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Commit Automation and Prompt Format Hardening. |
| 1.0.3 | 2026-05-28 | Promote Encoding Fix and Source-of-Truth Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Promote Encoding Fix and Source-of-Truth Hardening. |
| 1.0.4 | 2026-05-28 | Validate Script Output Compression | cleanup | not recorded | not recorded | not recorded | not recorded | Released Validate Script Output Compression. |
| 1.0.5 | 2026-05-28 | New Chathead Opener | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released New Chathead Opener. |
| 1.0.6 | 2026-05-28 | Mojibake Resolution and Scan | product behavior | not recorded | not recorded | not recorded | not recorded | Released Mojibake Resolution and Scan. |
| 1.0.7 | 2026-05-29 | Anti-Drift Baseline | product behavior | not recorded | not recorded | not recorded | not recorded | Released Anti-Drift Baseline. |
| 1.0.8 | 2026-05-29 | Doc Continuity Model | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Doc Continuity Model. |
| 1.0.9 | 2026-05-29 | Promote Self-Verify and CLAUDE.md Continuity | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Promote Self-Verify and CLAUDE.md Continuity. |
| 1.0.10 | 2026-05-29 | Roadmap Consolidation | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Roadmap Consolidation. |
| 1.0.11 | 2026-05-29 | Session Continuity and Bounded Initiative | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Session Continuity and Bounded Initiative. |
| 1.0.12 | 2026-05-29 | Phase Identity Sync | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Phase Identity Sync. |
| 1.0.13 | 2026-05-29 | Prompt and Commit Output Format Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Prompt and Commit Output Format Hardening. |
| 1.1.0 | 2026-05-29 | Graphify Integration | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Graphify Integration. |
| 1.1.1 | 2026-05-29 | Graph Stable Refresh Fix | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Graph Stable Refresh Fix. |
| 1.1.2 | 2026-05-29 | Graph Audit Harness | decision | not recorded | not recorded | not recorded | not recorded | Released Graph Audit Harness. |
| 1.1.3 | 2026-05-29 | Codex Validation Boundary Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Codex Validation Boundary Hardening. |
| 1.1.4 | 2026-05-29 | Graph Routing Usage Contract | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Graph Routing Usage Contract. |
| 1.2.0 | 2026-05-30 | ChromaDB Bootstrap | infrastructure | not recorded | not recorded | not recorded | not recorded | Released ChromaDB Bootstrap. |
| 1.2.1 | 2026-05-30 | Graph Navigation Doc Consistency | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Graph Navigation Doc Consistency. |
| 1.2.2 | 2026-05-30 | Chroma Visibility Fix | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Chroma Visibility Fix. |
| 1.2.3 | 2026-05-30 | Startup Oracle Cleanup | cleanup | not recorded | not recorded | not recorded | not recorded | Released Startup Oracle Cleanup. |
| 1.2.4 | 2026-05-30 | Handoff Drift Cleanup | cleanup | not recorded | not recorded | not recorded | not recorded | Released Handoff Drift Cleanup. |
| 1.2.5 | 2026-05-30 | Phase Routing Guardrail Cleanup | cleanup | not recorded | not recorded | not recorded | not recorded | Released Phase Routing Guardrail Cleanup. |
| 1.2.6 | 2026-05-30 | Roadmap Next-Phase Gate | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Roadmap Next-Phase Gate. |
| 1.2.7 | 2026-05-30 | Prompt Fence Safety Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Prompt Fence Safety Hardening. |
| 1.3.0 | 2026-05-30 | ChatGPT Architect Local Context Workflow | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released ChatGPT Architect Local Context Workflow. |
| 1.3.1 | 2026-05-30 | ChatGPT Architect Workflow Proof and Layout Review | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released ChatGPT Architect Workflow Proof and Layout Review. |
| 1.3.2 | 2026-05-30 | ChatGPT Architect Real Workflow Test | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released ChatGPT Architect Real Workflow Test. |
| 1.3.3 | 2026-05-30 | Docs Surface and Product Roadmap Rebaseline | decision | not recorded | not recorded | not recorded | not recorded | Released Docs Surface and Product Roadmap Rebaseline. |
| 1.4.0 | 2026-05-31 | View Projection Reproduction Tests | product behavior | not recorded | not recorded | not recorded | not recorded | Released View Projection Reproduction Tests. |
| 1.4.1 | 2026-05-31 | AI Handoff Next Session Cleanup | cleanup | not recorded | not recorded | not recorded | not recorded | Released AI Handoff Next Session Cleanup. |
| 1.4.2 | 2026-05-31 | Backend View Membership Contract | product behavior | not recorded | not recorded | not recorded | not recorded | Released Backend View Membership Contract. |
| 1.4.3 | 2026-05-31 | Dashboard Cache Projection Contract | product behavior | not recorded | not recorded | not recorded | not recorded | Released Dashboard Cache Projection Contract. |
| 1.4.4 | 2026-05-31 | Open Phase Roadmap Status Automation | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Open Phase Roadmap Status Automation. |
| 1.4.5 | 2026-05-31 | Tag Mutation Projection Regression | product behavior | not recorded | not recorded | not recorded | not recorded | Released Tag Mutation Projection Regression. |
| 1.4.6 | 2026-05-31 | View Switching Race Regression | product behavior | not recorded | not recorded | not recorded | not recorded | Released View Switching Race Regression. |
| 1.4.7 | 2026-05-31 | Create List + Create Item Race Regression | product behavior | not recorded | not recorded | not recorded | not recorded | Released Create List + Create Item Race Regression. |
| 1.4.8 | 2026-05-31 | Drag/Reorder Persistence Regression | product behavior | not recorded | not recorded | not recorded | not recorded | Released Drag/Reorder Persistence Regression. |
| 1.4.9 | 2026-05-31 | Branch-Based Phase Workflow Draft | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Branch-Based Phase Workflow Draft. |
| 1.4.10 | 2026-05-31 | Context Index Routing Map | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Context Index Routing Map. |
| 1.4.11 | 2026-05-31 | AI Handoff Compression | cleanup | not recorded | not recorded | not recorded | not recorded | Released AI Handoff Compression. |
| 1.4.12 | 2026-05-31 | Validation-Gated Assistant Response Hardening | product behavior | not recorded | not recorded | not recorded | not recorded | Released Validation-Gated Assistant Response Hardening. |
| 1.4.13 | 2026-05-31 | Codex Debugging Discipline Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Codex Debugging Discipline Hardening. |
| 1.4.14 | 2026-05-31 | Phase Branch Commit Workflow Finalization | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Phase Branch Commit Workflow Finalization. |
| 1.4.15 | 2026-05-31 | Closeout Evidence and Validation Efficiency Hardening | decision | not recorded | not recorded | not recorded | not recorded | Released Closeout Evidence and Validation Efficiency Hardening. |
| 1.4.16 | 2026-05-31 | Session Checkpoint Output Contract Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Session Checkpoint Output Contract Hardening. |
| 1.4.17 | 2026-05-31 | Session Log Folder Contract Correction | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Session Log Folder Contract Correction. |
| 1.4.18 | 2026-06-01 | Retire ChromaDB | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Retire ChromaDB. |
| 1.4.19 | 2026-06-01 | In-Alpha Commit-Before-Fix Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released In-Alpha Commit-Before-Fix Hardening. |
| 1.4.20 | 2026-06-01 | Git Artifact Hygiene Hardening | cleanup | not recorded | not recorded | not recorded | not recorded | Released Git Artifact Hygiene Hardening. |
| 1.4.21 | 2026-06-01 | Commit Script Deletion Staging | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Commit Script Deletion Staging. |
| 1.4.22 | 2026-06-01 | Startup Contract Unification | product behavior | not recorded | not recorded | not recorded | not recorded | Released Startup Contract Unification. |
| 1.4.23 | 2026-06-01 | Open Phase Status Flip Fix | product behavior | not recorded | not recorded | not recorded | not recorded | Released Open Phase Status Flip Fix. |
| 1.4.24 | 2026-06-01 | Routing Consolidation and CODEX_RULES Trim | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Routing Consolidation and CODEX_RULES Trim. |
| 1.4.25 | 2026-06-02 | ChatGPT and Codex Role Formalization | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released ChatGPT and Codex Role Formalization. |
| 1.4.26 | 2026-06-02 | Custom View Reorder E2E Stabilization | product behavior | not recorded | not recorded | not recorded | not recorded | Released Custom View Reorder E2E Stabilization. |
| 1.4.27 | 2026-06-03 | Authenticated E2E Suite Hardening | product behavior | not recorded | not recorded | not recorded | not recorded | Released Authenticated E2E Suite Hardening. |
| 1.4.28 | 2026-06-03 | Promote State-Doc Sync Automation | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Promote State-Doc Sync Automation. |
| 1.4.29 | 2026-06-04 | Parallel Auth E2E Isolation | product behavior | not recorded | not recorded | not recorded | not recorded | Released Parallel Auth E2E Isolation. |
| 1.4.30 | 2026-06-04 | Roadmap Rebaseline for 1.5.x Harness Series | decision | not recorded | not recorded | not recorded | not recorded | Released Roadmap Rebaseline for 1.5.x Harness Series. |
| 1.4.31 | 2026-06-04 | Workflow Closeout and Open-Phase Fixes | decision | not recorded | not recorded | not recorded | not recorded | Released Workflow Closeout and Open-Phase Fixes. |
| 1.5.0 | 2026-06-04 | Tidy Harness Skills and Hook Contracts | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Tidy Harness Skills and Hook Contracts. |
| 1.5.1 | 2026-06-04 | Local Memory Persistence and Learning Queue | product behavior | not recorded | not recorded | not recorded | not recorded | Released Local Memory Persistence and Learning Queue. |
| 1.5.2 | 2026-06-04 | AI Context Budget Audit | decision | not recorded | not recorded | not recorded | not recorded | Released AI Context Budget Audit. |
| 1.5.3 | 2026-06-04 | Operational Skill Re-Architecture | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Operational Skill Re-Architecture. |
| 1.5.4 | 2026-06-04 | Session Checkpoint Deprecation | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Session Checkpoint Deprecation. |
| 1.5.5 | 2026-06-04 | Real Hook Guardrails | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Real Hook Guardrails. |
| 1.5.6 | 2026-06-04 | Phase Eval Artifact Baseline | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Phase Eval Artifact Baseline. |
| 1.5.7 | 2026-06-04 | Consolidated Closeout Packet | decision | not recorded | not recorded | not recorded | not recorded | Released Consolidated Closeout Packet. |
| 1.5.8 | 2026-06-04 | Local Evidence Packet Code-Block Contract | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Local Evidence Packet Code-Block Contract. |
| 1.6.0 | 2026-06-04 | Ownership Failure Test Baseline | product behavior | not recorded | not recorded | not recorded | not recorded | Released Ownership Failure Test Baseline. |
| 1.6.1 | 2026-06-04 | List Item Ownership Fixes | product behavior | not recorded | not recorded | not recorded | not recorded | Released List Item Ownership Fixes. |
| 1.6.2 | 2026-06-04 | Reorder Target List Ownership Fix | product behavior | not recorded | not recorded | not recorded | not recorded | Released Reorder Target List Ownership Fix. |
| 1.6.3 | 2026-06-04 | Ownership Regression Sweep | product behavior | not recorded | not recorded | not recorded | not recorded | Released Ownership Regression Sweep. |
| 1.6.4 | 2026-06-04 | Workflow Skill Evolution Sweep | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Workflow Skill Evolution Sweep. |
| 1.6.5 | 2026-06-05 | Codebase Graph Generator Stability Fix | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Codebase Graph Generator Stability Fix. |
| 1.6.6 | 2026-06-05 | Phase Scoping and Opening Workflow Hardening | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Phase Scoping and Opening Workflow Hardening. |
| 1.7.0 | 2026-06-05 | Optimistic Queue Race Test Baseline | product behavior | not recorded | not recorded | not recorded | not recorded | Released Optimistic Queue Race Test Baseline. |
| 1.7.1 | 2026-06-05 | Scope Rollback Rules | product behavior | not recorded | not recorded | not recorded | not recorded | Released Scope Rollback Rules. |
| 1.7.2 | 2026-06-05 | Pending Mutation Cancellation Rules | product behavior | not recorded | not recorded | not recorded | not recorded | Released Pending Mutation Cancellation Rules. |
| 1.7.3 | 2026-06-05 | Refresh/Crash Pending Work Decision | decision | not recorded | not recorded | not recorded | not recorded | Released Refresh/Crash Pending Work Decision. |
| 1.8.0 | 2026-06-05 | Local DB Role Audit Through Tests | decision | not recorded | not recorded | not recorded | not recorded | Released Local DB Role Audit Through Tests. |
| 1.8.1 | 2026-06-05 | Scope-Output Opening-Sequence Template | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Scope-Output Opening-Sequence Template. |
| 1.8.2 | 2026-06-05 | Script-Printed Command Re-Emit Hardening | product behavior | not recorded | not recorded | not recorded | not recorded | Released Script-Printed Command Re-Emit Hardening. |
| 1.8.3 | 2026-06-05 | Post-Validation Closeout Enforcement | decision | not recorded | not recorded | not recorded | not recorded | Released Post-Validation Closeout Enforcement. |
| 1.8.4 | 2026-06-05 | Workflow Source-of-Truth Migration Into Skills | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Workflow Source-of-Truth Migration Into Skills. |
| 1.8.5 | 2026-06-05 | Outbox Replay Integration Test Plan | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Outbox Replay Integration Test Plan. |
| 1.8.6 | 2026-06-05 | Offline Write Path Prototype | product behavior | not recorded | not recorded | not recorded | not recorded | Released Offline Write Path Prototype. |
| 1.8.7 | 2026-06-05 | Local-First Status Alignment and Roadmap Correction | decision | not recorded | not recorded | not recorded | not recorded | Released Local-First Status Alignment and Roadmap Correction. |
| 1.9.0 | 2026-06-05 | Dashboard Component Responsibility Audit | decision | not recorded | not recorded | not recorded | not recorded | Released Dashboard Component Responsibility Audit. |
| 1.9.1 | 2026-06-05 | Extract Dashboard Query Key Helper | refactor | not recorded | not recorded | not recorded | not recorded | Released Extract Dashboard Query Key Helper. |
| 1.9.2 | 2026-06-05 | Extract List Mutation Cache Helpers | refactor | not recorded | not recorded | not recorded | not recorded | Released Extract List Mutation Cache Helpers. |
| 1.9.3 | 2026-06-06 | Extract View Mutation Cache Helpers | refactor | not recorded | not recorded | not recorded | not recorded | Released Extract View Mutation Cache Helpers. |
| 1.9.4 | 2026-06-06 | Extract Tag Mutation Cache Helpers | refactor | not recorded | not recorded | not recorded | not recorded | Released Extract Tag Mutation Cache Helpers. |
| 1.9.5 | 2026-06-06 | Dashboard Mutation to Outbox Wiring | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dashboard Mutation to Outbox Wiring. |
| 1.9.6 | 2026-06-06 | Durable Pending-Write Integration | product behavior | not recorded | not recorded | not recorded | not recorded | Released Durable Pending-Write Integration. |
| 1.9.7 | 2026-06-06 | Automatic Replay Worker | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Automatic Replay Worker. |
| 1.9.8 | 2026-06-06 | Sync Status UI Surface | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Sync Status UI Surface. |
| 1.9.9 | 2026-06-06 | Offline Conflict Resolution Rules | decision | not recorded | not recorded | not recorded | not recorded | Released Offline Conflict Resolution Rules. |
| 1.9.10 | 2026-06-06 | Local DB Source-of-Truth Decision | decision | not recorded | not recorded | not recorded | not recorded | Released Local DB Source-of-Truth Decision. |
| 1.9.11 | 2026-06-07 | Product-First Planning Contract and Roadmap Rebaseline | decision | not recorded | not recorded | not recorded | not recorded | Released Product-First Planning Contract and Roadmap Rebaseline. |
| 1.9.12 | 2026-06-07 | Agent Role-Model Realignment | product behavior | not recorded | not recorded | not recorded | not recorded | Released Agent Role-Model Realignment. |
| 1.9.13 | 2026-06-07 | Stale Doc Content Sweep | cleanup | not recorded | not recorded | not recorded | not recorded | Released Stale Doc Content Sweep. |
| 1.9.14 | 2026-06-07 | Version-History Ownership De-Dup | cleanup | not recorded | not recorded | not recorded | not recorded | Released Version-History Ownership De-Dup. |
| 1.9.15 | 2026-06-07 | Retire/Compress ai-harness Pointer Surface | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Retire/Compress ai-harness Pointer Surface. |
| 1.9.16 | 2026-06-08 | Dev-Gated Local-First Create List Slice | product behavior | not recorded | not recorded | not recorded | not recorded | Released Dev-Gated Local-First Create List Slice. |
| 1.9.17 | 2026-06-08 | Stabilize and Enable Local-First Create List Slice | product behavior | not recorded | not recorded | not recorded | not recorded | Released Stabilize and Enable Local-First Create List Slice. |
| 1.9.18 | 2026-06-09 | Roadmap Re-Plan Correction (SW-First Re-Sequence) | decision | not recorded | not recorded | not recorded | not recorded | Released Roadmap Re-Plan Correction (SW-First Re-Sequence). |
| 1.9.19 | 2026-06-09 | Offline App-Shell (Service Worker) | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Offline App-Shell (Service Worker). |
| 1.9.20 | 2026-06-10 | Dexie Read Fallback (API-Unavailable) | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie Read Fallback (API-Unavailable). |
| 1.9.21 | 2026-06-10 | Dexie<->Server Reconciliation & Lifecycle | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie<->Server Reconciliation & Lifecycle. |
| 1.9.22 | 2026-06-10 | Bounded Batch Sync Endpoint & Server Apply | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Bounded Batch Sync Endpoint & Server Apply. |
| 1.9.23 | 2026-06-10 | Dexie-First List & Item CRUD | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie-First List & Item CRUD. |
| 1.9.24 | 2026-06-11 | Dexie-First Movement, Ordering & View-Switch Consistency | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie-First Movement, Ordering & View-Switch Consistency. |
| 1.9.25 | 2026-06-11 | Dexie-First Tags, Views & Relationships | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie-First Tags, Views & Relationships. |
| 1.9.26 | 2026-06-12 | Batch Sync Lifecycle, Retry & Recovery | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Batch Sync Lifecycle, Retry & Recovery. |
| 1.9.27 | 2026-06-12 | Roadmap Re-Plan Correction (Overlay-First Re-Sequence) | decision | not recorded | not recorded | not recorded | not recorded | Released Roadmap Re-Plan Correction (Overlay-First Re-Sequence). |
| 1.9.28 | 2026-06-12 | Dexie-First Reconcile Overlay | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Dexie-First Reconcile Overlay. |
| 1.9.29 | 2026-06-13 | Direct-Write Retirement & Default Dexie-First | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Direct-Write Retirement & Default Dexie-First. |
| 1.9.30 | 2026-06-13 | Delete Outbox Payload Validation Fix | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Delete Outbox Payload Validation Fix. |
| 1.9.31 | 2026-06-13 | E2E Auth-Suite Sync-Timing Assertion Hardening | infrastructure | not recorded | not recorded | not recorded | not recorded | Released E2E Auth-Suite Sync-Timing Assertion Hardening. |
| 1.9.32 | 2026-06-14 | Local-First Dashboard Architecture Closeout | decision | not recorded | not recorded | not recorded | not recorded | Released Local-First Dashboard Architecture Closeout. |
| 1.10.0 | 2026-06-14 | Copy and Metadata Hygiene | cleanup | not recorded | not recorded | not recorded | not recorded | Released Copy and Metadata Hygiene. |
| 1.10.1 | 2026-06-14 | Landing Page Branding Polish | product behavior | not recorded | not recorded | not recorded | not recorded | Released Landing Page Branding Polish. |
| 2.0.0 | 2026-06-14 | Replicache Read-Path Inversion (Local Store as Render Source) | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Replicache Read-Path Inversion (Local Store as Render Source). |
| 2.0.1 | 2026-06-14 | Fractional Indexing for Order | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Fractional Indexing for Order. |
| 2.0.2 | 2026-06-14 | Supabase Broadcast Realtime Poke | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Supabase Broadcast Realtime Poke. |
| 2.0.3 | 2026-06-14 | Sharing & Permissions | product behavior | not recorded | not recorded | not recorded | not recorded | Released Sharing & Permissions. |
| 2.0.4 | 2026-06-14 | Replicache Pull Cookie Monotonicity Fix | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Replicache Pull Cookie Monotonicity Fix. |
| 2.0.5 | 2026-06-14 | Share Redeem Error UX Hardening | product behavior | not recorded | not recorded | not recorded | not recorded | Released Share Redeem Error UX Hardening. |
| 2.0.6 | 2026-06-16 | Yjs Collaborative Item Notes | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Yjs Collaborative Item Notes. |
| 2.0.7 | 2026-06-16 | Realtime Poke Send Authorization | infrastructure | not recorded | not recorded | not recorded | not recorded | Released Realtime Poke Send Authorization. |
| 2.0.8 | 2026-06-16 | Remove Dead Replicache License Config | cleanup | not recorded | not recorded | not recorded | not recorded | Released Remove Dead Replicache License Config. |
| 2.0.9 | 2026-06-17 | Retire Legacy Overlay / Outbox-Render / tRPC-Render Paths | refactor | not recorded | not recorded | not recorded | not recorded | Released Retire Legacy Overlay / Outbox-Render / tRPC-Render Paths. |
| 2.1.0 | 2026-06-17 | Deploy Env Documentation | docs/workflow | not recorded | not recorded | not recorded | not recorded | Released Deploy Env Documentation. |
| 2.1.1 | 2026-06-18 | Build/Migration Readiness | product behavior | not recorded | not recorded | not recorded | not recorded | Released Build/Migration Readiness. |
| 2.1.2 | 2026-06-18 | Production Smoke Checklist | product behavior | not recorded | not recorded | not recorded | not recorded | Released Production Smoke Checklist. |
| 2.2.0 | 2026-06-18 | Visual Review Pass | product behavior | not recorded | not recorded | not recorded | not recorded | Released Visual Review Pass. |
| 2.2.1 | 2026-06-18 | Retire test:e2e:replicache Render Gate | refactor | not recorded | not recorded | not recorded | not recorded | Released Retire test:e2e:replicache Render Gate. |
| 2.2.2 | 2026-06-18 | View Create Idempotency Hardening | product behavior | not recorded | not recorded | not recorded | not recorded | Released View Create Idempotency Hardening. |
| 2.2.3 | 2026-06-19 | seriesComplete Flag Reconciliation | product behavior | not recorded | not recorded | not recorded | not recorded | Released seriesComplete Flag Reconciliation. |
| 3.0.0 | 2026-06-19 | Collab Arc Roadmap Pin | docs/workflow | none | none | doc-consistency gates (validate -SkipE2E) | docs/FUTURE_PLANS.md | Pinned the 3.0/4.0 collaboration-arc roadmap into Planned. |
| 3.0.1 | 2026-06-19 | Version History Re-Ownership | docs/workflow (release tooling + docs) | none - internal release/doc machinery. | none - no product runtime change; the new owner is exercised by promote.ps1 at this phase's own closeout. | .\scripts\validate.ps1 -SkipE2E with the rewired gates green; manual proof = this phase's promotion writes its own VERSIONING row. Script behavior has no PowerShell unit harness (documented gap). | docs/VERSIONING.md, docs/FUTURE_PLANS.md, scripts/validate.ps1, scripts/promote.ps1, ownership references in docs/CODEX_RULES.md and AGENTS.md. | Re-own completed-version history in docs/VERSIONING.md as a rich table (Version, Date, Title, Type, Product Impact, Runtime Target, Validation Target, Files, Notes); backfill all released versions; repoint FUTURE_PLANS Completed; rewire promote.ps1 and validate.ps1 to the new owner. |
| 3.0.2 | 2026-06-19 | Repo, Docs & Skills Cleanup | cleanup | none - internal hygiene. | none. | .\scripts\validate.ps1 -SkipE2E doc gates. | docs/FUTURE_PLANS.md, docs/AI_HANDOFF.md, .claude/skills/* (as needed) | Reconcile docs/skills for the new arc - prune or redirect Potential Next Directions now superseded by pinned phases, align AI_HANDOFF invariants/known-risks with the arc spine, confirm the skill surface still matches the workflow. |
| 3.0.3 | 2026-06-19 | Startup Context Budget Rebaseline | docs/workflow | none - internal AI workflow efficiency and drift prevention. | `scripts/ai-context-budget.ps1` remains the on-demand report and exposes strict enforcement used by `scripts/validate.ps1`. | `npm run budget:context` reports startup context below 8,000 tokens (target below 7,500 for margin); `./scripts/validate.ps1 -SkipE2E` proves the enforced gate. Script behavior has no PowerShell unit harness. | AGENTS.md, docs/FUTURE_PLANS.md, docs/AI_HANDOFF.md, docs/COMPACT_STRATEGY.md, scripts/ai-context-budget.ps1, scripts/validate.ps1, .claude/skills/tidy-context-budget/SKILL.md. | Compress startup-loaded guidance without weakening its rails, bring the startup context estimate below 8,000 tokens with margin, and enforce that ceiling during validation. |
| 3.0.4 | 2026-06-19 | Design System Source of Truth | docs/workflow | none directly - governs later visual phases. | none - reference doc; tokens are implemented in 3.2.0. | doc gates; establish the design.md bidirectional-consistency rule. | docs/design.md (new), docs/CONTEXT_INDEX.md (route entry) | Create docs/design.md as the single UI/design source of truth (tokens, layout shells, component contracts, dark-mode intent) governing all 3.2+ visual work. |
| 3.1.0 | 2026-06-19 | Sync Latency Measurement Spike | decision (spike) | none - measurement only. | none - spike artifacts removed or gated; findings feed 3.1.1. | spike report committed (numbers + bottleneck hypothesis). | lib/sync/* (temporary instrumentation), docs/ (spike report) | Instrument and measure real Replicache push/pull + poke latency (local mutation to peer render) under representative load; produce a numbers report. Throwaway instrumentation. |

---

## Planned Phases

The forward roadmap lives in `docs/FUTURE_PLANS.md` (the `Planned` section) - the
single version-sequenced owner. This file keeps history + rules only. Do not
maintain a second roadmap table here.

