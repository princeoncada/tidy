# Future Plans

Single version-sequenced plan for Tidy. This file is the ONE owner of the roadmap;
`docs/VERSIONING.md` holds history + rules only. Every committed item carries its
target version. Only Potential Next Directions are unversioned. Update every phase.

Current version: see `STATE.json` (do not restate it here).

Version rules: patches (Z) may ship under the current minor before the next X/Y.
Inserting a new minor/major pushes later Planned numbers back to stay monotonic
(see the Planned Renumber Rule in `docs/VERSIONING.md`).

## Status Legend
- `Open`: not started
- `In progress`: active branch
- `Blocked`: needs an external decision/dependency
- `Done`: completed (struck through under Completed)

## Phase Declaration Format

Every Planned phase declares these fields in addition to `Status` and `Files`. This is the roadmap surface of the Product-First Planning Contract; the rule itself lives in `docs/WORKFLOW.md` (Product-First Planning Contract).

- **Type:** product behavior | infrastructure | decision | refactor | docs/workflow | cleanup
- **Implementation goal:** what the phase builds.
- **Product impact:** the user-visible effect, or `none - <why>`.
- **Runtime integration target:** what actually runs after the phase, or `none - <why>`.
- **Deferral boundary:** what is explicitly NOT done, naming the follow-up phase or decision.
- **Validation target:** targeted-alpha checks (plus a manual product proof for product phases); full suite before stable.

Phases need not be user-visible, but none may silently defer expected product integration without naming the follow-up phase or decision.

---

## Completed

Completed-version history lives in `docs/VERSIONING.md` under `## Version History`, the single owner.

---

## In Progress


- 3.6.4 - Workspace OS Rebase RFC (active) - see Planned
---

## Planned

**3.6 Tidy Stewardship Arc - Context (orientation, not a phase)**

Arc goal: prepare the repository, documentation, source-of-truth map, and AI-agent workflow before the 4.0 Workspace OS product-model rebase.

Problem:
- Tidy is about to shift from a todo-list productivity app into a lightweight workspace OS.
- The repo must not carry stale todo-era assumptions, duplicate truths, unclear docs ownership, disconnected files, wrong pathing, or overloaded workflow surfaces into that pivot.
- Claude Code, Codex, and ChatGPT support should remain grounded in current source-of-truth files and small phase discipline.
- The agent workflow needs to be updated so ChatGPT, Claude Code, and Codex have distinct responsibilities that match the actual intended development flow.

Source-of-truth spine:
- `STATE.json` remains the machine-readable version/state/phase oracle.
- `docs/FUTURE_PLANS.md` remains the roadmap owner.
- `docs/AI_HANDOFF.md` remains the current architecture, invariant, risk, and handoff owner.
- `docs/design.md` remains the UI/design contract owner.
- `docs/VERSIONING.md` remains version rules and released history.
- `docs/WORKFLOW.md` and `docs/CODEX_RULES.md` remain agent workflow and implementation boundary owners.
- The Tidy stewardship folder maps, audits, and supports these owner docs. It must not become a competing roadmap, architecture spec, or design system.

Agent responsibility target:
- ChatGPT becomes the second-opinion provider, docs/workflow auditor, docs/skills workflow fixer based on audit findings, and future-planning assistant. ChatGPT may read code and write repo changes when explicitly working inside a scoped docs/workflow/support phase, but its primary role is still review, audit, inconsistency detection, stale-end detection, disconnected-file detection, wrong-path detection, and roadmap-support review.
- Claude Code becomes the future-plan architect and phase-scope explainer. Claude Code should explain which files are touched, what has to happen, and the concise step-by-step pseudo-code / implementation plan Codex needs. Claude Code no longer owns final validation. Claude Code provides manual validation instructions the user must approve.
- Codex becomes the implementation and validation agent. Codex implements from Claude Code's master prompt, runs or provides the required validation path according to the updated repo rules, reports validation evidence, and identifies any required follow-up fixes before closeout.
- The user/controller remains the approval authority for manual product validation and closeout decisions.

Execution discipline:
- Read broadly, write surgically, delete only with evidence.
- Classify stale materials before deleting or redirecting them.
- Prefer small cleanup phases over one large docs purge.
- Keep runtime behavior unchanged unless a later phase explicitly scopes runtime cleanup.
- Preserve clear validation evidence before closeout.
- Do not let stewardship docs become duplicate source-of-truth docs.

### 3.6.4 - Workspace OS Rebase RFC
- **Status:** In progress
- **Type:** decision
- **Implementation goal:** Write the architecture/product RFC for moving Tidy from a todo-list productivity app into a lightweight workspace OS. Define the target product grammar, preserved technical spine, migration sequence, non-goals, and first 4.0 implementation slice.
- **Product impact:** none directly - users see no runtime behavior change in this phase. The phase decides and documents the product identity pivot that later phases implement.
- **Runtime integration target:** none - decision/RFC only.
- **Deferral boundary:** Does not implement pages, projects, work-item renames, universal views, command palette, backlinks, schema changes, or UI rebase. Does not rewrite current runtime concepts before the RFC is accepted. Implementation starts in 4.0.0 or later.
- **Validation target:** Docs/workflow validation plus manual architecture review. Confirm the RFC identifies product nouns, current-to-target mapping, preserved invariants, migration risks, data-model implications, design-system implications, agent-workflow implications, and explicit non-goals.
- **Files:** `docs/rfcs/workspace-os-rebase.md`, `docs/tidy/WORKSPACE_OS_REBASE_NOTES.md` if retained as support notes, `docs/FUTURE_PLANS.md`, `docs/AI_HANDOFF.md`, `docs/design.md` if target design contracts are introduced as future targets, `docs/CONTEXT_INDEX.md`.

**4.0 Workspace OS Rebase Arc - Context (orientation, not a phase)**

Arc goal: evolve Tidy from a todo-list productivity app into a lightweight workspace OS.

RFC: the architecture/product decision for this arc is owned by `docs/rfcs/workspace-os-rebase.md` (authored in 3.6.4). It is the single source for target product grammar, current-to-target noun mapping, preserved spine, migration sequence, and the first 4.0.0 slice; this arc context stays orientation-only and does not duplicate it.

Target direction:
- Notion-like page/canvas experience.
- Plane-like project/work-item grammar.
- Tidy's existing restrained UI taste.
- shadcn/Radix as the main component foundation.
- Replicache as the local-first structural sync spine.
- Yjs for collaborative document bodies.
- Presence separate from Replicache structural sync.
- Lightweight runtime, small vertical slices, and no bloated Notion-clone surface.

Architecture spine:
- The rebase should evolve the existing app shell, not replace it wholesale.
- Current lists/items/views/workspaces should be mapped deliberately into future projects/pages/work-items/views rather than renamed blindly.
- The first implementation slice should prove the new product grammar with minimal runtime disruption.
- Source-of-truth docs must move with the runtime model: roadmap, handoff, design contracts, and context routing must stay in sync.

Execution discipline:
- Do not perform a large schema rewrite as the first move.
- Do not rename every concept before the product model is proven.
- Introduce the Workspace OS model through thin vertical slices.
- Preserve current sync, auth, permissions, and local-first behavior unless a phase explicitly changes them.
- Keep 4.0.0 focused on the product-model foundation, not every future feature.

### 4.0.0 - Workspace OS Product Model Rebase
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Start the product identity shift from todo-list productivity app to lightweight workspace OS by introducing the first runtime-supported product model changes from the Workspace OS Rebase RFC. Establish the initial current-to-target mapping for core nouns such as workspace, project/space, page, work item, and view.
- **Product impact:** Users begin seeing Tidy as a workspace rather than only a todo/list app, through the first concrete product-model and UI changes.
- **Runtime integration target:** The first Workspace OS slice runs on the existing authenticated dashboard shell, Replicache structural sync spine, Yjs document-body path where applicable, shadcn component foundation, and existing permission model.
- **Deferral boundary:** Does not clone Notion or Plane wholesale. Does not ship the full page editor, universal object graph, command center, backlinks, analytics, mobile app, MCP integration, or complete schema migration unless separately scoped. Does not replace Replicache, Yjs, shadcn, or the existing auth/permission spine.
- **Validation target:** Targeted tests for the first rebase slice plus manual product proof that the new model appears in the UI, preserves existing list/item/board behavior where still supported, and does not break sync, permissions, or local-first rendering. Design parity review against `docs/design.md` updates if visual/product contracts change.
- **Files:** `docs/rfcs/workspace-os-rebase.md`, `docs/AI_HANDOFF.md`, `docs/design.md`, `docs/CONTEXT_INDEX.md`, relevant dashboard/product-model source files selected during phase scoping, related tests.

---

## Potential Next Directions (unversioned)

Assigned a version only when scoped.
- Investigate why open-phase.ps1/promote.ps1's committed codebase-graph.json (fallback generator) reads as stale against validate.ps1's freshness regeneration, so the Section 2 graph refresh is not needed on every phase (scripts/generate-codebase-graph.ps1, scripts/generate_codebase_graph.py, scripts/validate.ps1)
- One-time deterministic `ListItem.boardOrderKey` backfill to remove the multiplayer board legacy-null rollout window.
- Rate limiting and abuse controls
- Persistent sync idempotency ledger for duplicate-request auditability beyond semantic idempotency (distinct from the 3.5.0 mutation ledger, which serves history/time-travel)
- Observability
- Scale/performance profiling
- Order compaction
- Notion-style visual historical-snapshot view: render a read-only reconstruction of past dashboard state (lists/items/views) at a chosen ledger entry by replaying the MutationLedgerEntry ledger, distinct from 3.5.2 revert which writes the reconstructed state back through the spine (lib/history/replay.ts, components/history/*).
- Installable-PWA polish: manifest metadata + icon set (the app-shell service worker and app/manifest.ts already ship)
- Mobile/touch drag-drop + responsive QA (components/list/*)
- Accessibility + UI polish pass (folds into 3.2.x design-token + shell work when scoped)
- Migration/backfill playbook (prisma/schema.prisma, prisma/migrations/*)

Superseded by pinned arc phases (pointers, not separate backlog):
- Finer-grained shared-list collaboration - sharing owner tags/custom views with recipients, and letting recipients reorder shared lists within their own organization - is owned by 3.4.2 (Collaboration & Sharing UX).
- Replicache pull resiliency under concurrent pulls (`buildReplicacheClientView` `list.listItems` crash) and `selectedView` convergence for `tests/e2e/views.spec.ts` "latest selected view wins after fast switching" - now owned by 3.2.8 (Concurrent-Pull Resilience & Fast-Switch View Convergence). Pre-existing; surfaced during 3.2.4, reconfirmed at `--workers=2` during 3.2.5.
- Rich-text/structured item notes and remote-cursor presence are owned by 3.3.0 (item panel/notes) and 3.4.0/3.4.3/3.4.4 (presence transport spike + transport hardening + live presence UI); plain-text Yjs notes already shipped in 2.0.6.

---

## Discarded / Won't Do

- **1.10.1 - Auth Flow Copy Polish - retired 2026-06-14.** Its only deliverable, the Register submit button reading "Login", already shipped in commit 2489cae (the button reads "Register"); the driving Known Risk was stale. The phase is removed and the former "1.10.2 - Landing Page Branding Polish" is renumbered down to 1.10.1 to keep the patch sequence gapless. No work item is dropped.
- **1.9.x server-authoritative render + pending-outbox overlay as the local-first UX path** - superseded 2026-06-14. Rendering from the tRPC server payload plus `lib/local-db/local-overlay.ts`, with Dexie only as an offline fallback, leaves the optimistic / overlay / refetch three-way race (the perceived flicker). The 2.0 arc replaces it with a Replicache local-store render; the overlay / outbox-render / tRPC-render paths are retired in 2.0.7. The Dexie-first WRITE path and bounded batch sync are NOT discarded - those concepts carry forward into Replicache's push handler. See `docs/DECISIONS.md` (2026-06-14).
- **Roadmap renumber (2026-06-14):** old 1.11.0-1.11.2 polish pulled forward to 1.10.0-1.10.2; old 1.10.0-1.10.2 deploy readiness pushed to 2.1.0-2.1.2 and old 1.11.3 visual review to 2.2.0, so deployment docs are written once against the 2.0 architecture. No work item is dropped; only resequenced.
- **Roadmap renumber (2026-06-14, post-2.0.3 R9):** inserted 2.0.4 - Replicache Pull Cookie Monotonicity Fix ahead of the collaboration work after R9 verification exposed a latent pull-cookie lexicographic-ordering bug. 2.0.4 Yjs Collaborative Item Notes -> 2.0.5; 2.0.5 Retire Legacy paths -> 2.0.6 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-14, post-2.0.4 R9):** inserted 2.0.5 - Share Redeem Error UX Hardening ahead of the collaboration work after R9 surfaced a revoked-link redemption UX failure (unhandled rejection on the /share redeem page). Yjs Collaborative Item Notes 2.0.5 -> 2.0.6; Retire Legacy paths 2.0.6 -> 2.0.7 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-16):** inserted 2.0.7 - Realtime Poke Send Authorization ahead of the cleanup work to fix shared-rename propagation latency (the server poke could not send because realtime.messages RLS, enabled in 2.0.6, blocks the anon key on INSERT). Retire Legacy paths 2.0.7 -> 2.0.8 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-16, dead-config carve-out):** carved the dead `licenseKey` / `NEXT_PUBLIC_REPLICACHE_LICENSE_KEY` removal out of the retirement phase into a new small 2.0.8 - Remove Dead Replicache License Config. Retire Legacy paths 2.0.8 -> 2.0.9 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap redirect (2026-06-28, 3.6 Stewardship + 4.0 Workspace OS):** the old **4.0 - Expo / React Native Mobile** and **4.1 - MCP Integration** Planned phases are superseded by the new 3.6 Tidy Stewardship Arc (3.6.0-3.6.4) and the reframed 4.0 Workspace OS Rebase Arc (4.0.0). Native mobile and MCP are NOT dropped - they fold into 4.0.0's deferral boundary ("mobile app, MCP integration ... unless separately scoped") and will be rebroken into Planned phases when scoped. STATE.json nextPhase moved 4.0 -> 3.6.0 in lockstep with VERSIONING (Next phase) and AI_HANDOFF (Next). The completed 3.0-3.5 "Collaboration Arc - Context" orientation block was also dropped from Planned (its live invariants remain in docs/AI_HANDOFF.md). No work item dropped; only resequenced and reframed.

---

## Known Cross-Cutting Risks

Live cross-cutting risks are owned by `docs/AI_HANDOFF.md` ("Known Risks"), kept current with the Replicache architecture. The 1.9.x optimistic-queue, Dexie-fallback, and pending-overlay risks formerly listed here were retired by the 2.0 Replicache render inversion; see `docs/AI_HANDOFF.md` "Removed Legacy Paths".

