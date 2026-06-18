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

- ~~1.0.0 - AI Workflow Foundation~~ (stable 2026-05-28)
- ~~1.0.1 - AGENTS.md Hardening~~ (stable 2026-05-28)
- ~~1.0.2 - Commit Automation and Prompt Format Hardening~~ (stable 2026-05-28)
- ~~1.0.3 - Promote Encoding Fix and Source-of-Truth Hardening~~ (stable 2026-05-28)
- ~~1.0.4 - Validate Script Output Compression~~ (stable 2026-05-28)
- ~~1.0.5 - New Chathead Opener~~ (stable 2026-05-28)
- ~~1.0.6 - Mojibake Resolution and Scan~~ (stable 2026-05-28)
- ~~1.0.7 - Anti-Drift Baseline~~ (stable 2026-05-29)
- ~~1.0.8 - Doc Continuity Model~~ (stable 2026-05-29)
- ~~1.0.9 - Promote Self-Verify and CLAUDE.md Continuity~~ (stable 2026-05-29)
- ~~1.0.10 - Roadmap Consolidation~~ (stable 2026-05-29)
- ~~1.0.11 - Session Continuity and Bounded Initiative~~ (stable 2026-05-29)

- ~~1.0.12 - Phase Identity Sync~~ (stable 2026-05-29)

- ~~1.0.13 - Prompt and Commit Output Format Hardening~~ (stable 2026-05-29)

- ~~1.1.0 - Graphify Integration~~ (stable 2026-05-29)

- ~~1.1.1 - Graph Stable Refresh Fix~~ (stable 2026-05-29)

- ~~1.1.2 - Graph Audit Harness~~ (stable 2026-05-29)

- ~~1.1.3 - Codex Validation Boundary Hardening~~ (stable 2026-05-29)

- ~~1.1.4 - Graph Routing Usage Contract~~ (stable 2026-05-29)

- ~~1.2.0 - ChromaDB Bootstrap~~ (stable 2026-05-30)

- ~~1.2.1 - Graph Navigation Doc Consistency~~ (stable 2026-05-30)

- ~~1.2.2 - Chroma Visibility Fix~~ (stable 2026-05-30)

- ~~1.2.3 - Startup Oracle Cleanup~~ (stable 2026-05-30)

- ~~1.2.4 - Handoff Drift Cleanup~~ (stable 2026-05-30)

- ~~1.2.5 - Phase Routing Guardrail Cleanup~~ (stable 2026-05-30)

- ~~1.2.6 - Roadmap Next-Phase Gate~~ (stable 2026-05-30)

- ~~1.2.7 - Prompt Fence Safety Hardening~~ (stable 2026-05-30)

- ~~1.3.0 - ChatGPT Architect Local Context Workflow~~ (stable 2026-05-30)

- ~~1.3.1 - ChatGPT Architect Workflow Proof and Layout Review~~ (stable 2026-05-30)

- ~~1.3.2 - ChatGPT Architect Real Workflow Test~~ (stable 2026-05-30)

- ~~1.3.3 - Docs Surface and Product Roadmap Rebaseline~~ (stable 2026-05-30)

- ~~1.4.0 - View Projection Reproduction Tests~~ (stable 2026-05-31)

- ~~1.4.1 - AI Handoff Next Session Cleanup~~ (stable 2026-05-31)

- ~~1.4.2 - Backend View Membership Contract~~ (stable 2026-05-31)

- ~~1.4.3 - Dashboard Cache Projection Contract~~ (stable 2026-05-31)

- ~~1.4.4 - Open Phase Roadmap Status Automation~~ (stable 2026-05-31)

- ~~1.4.5 - Tag Mutation Projection Regression~~ (stable 2026-05-31)

- ~~1.4.6 - View Switching Race Regression~~ (stable 2026-05-31)

- ~~1.4.7 - Create List + Create Item Race Regression~~ (stable 2026-05-31)

- ~~1.4.8 - Drag/Reorder Persistence Regression~~ (stable 2026-05-31)

- ~~1.4.9 - Branch-Based Phase Workflow Draft~~ (stable 2026-05-31)

- ~~1.4.10 - Context Index Routing Map~~ (stable 2026-05-31)

- ~~1.4.11 - AI Handoff Compression~~ (stable 2026-05-31)

- ~~1.4.12 - Validation-Gated Assistant Response Hardening~~ (stable 2026-05-31)

- ~~1.4.13 - Codex Debugging Discipline Hardening~~ (stable 2026-05-31)

- ~~1.4.14 - Phase Branch Commit Workflow Finalization~~ (stable 2026-05-31)

- ~~1.4.15 - Closeout Evidence and Validation Efficiency Hardening~~ (stable 2026-05-31)

- ~~1.4.16 - Session Checkpoint Output Contract Hardening~~ (stable 2026-05-31)

- ~~1.4.17 - Session Log Folder Contract Correction~~ (stable 2026-05-31)

- ~~1.4.18 - Retire ChromaDB~~ (stable 2026-06-01)

- ~~1.4.19 - In-Alpha Commit-Before-Fix Hardening~~ (stable 2026-06-01)

- ~~1.4.20 - Git Artifact Hygiene Hardening~~ (stable 2026-06-01)

- ~~1.4.21 - Commit Script Deletion Staging~~ (stable 2026-06-01)

- ~~1.4.22 - Startup Contract Unification~~ (stable 2026-06-01)

- ~~1.4.23 - Open Phase Status Flip Fix~~ (stable 2026-06-01)

- ~~1.4.24 - Routing Consolidation and CODEX_RULES Trim~~ (stable 2026-06-01)

- ~~1.4.25 - ChatGPT and Codex Role Formalization~~ (stable 2026-06-02)

- ~~1.4.26 - Custom View Reorder E2E Stabilization~~ (stable 2026-06-02)

- ~~1.4.27 - Authenticated E2E Suite Hardening~~ (stable 2026-06-03)

- ~~1.4.28 - Promote State-Doc Sync Automation~~ (stable 2026-06-03)

- ~~1.4.29 - Parallel Auth E2E Isolation~~ (stable 2026-06-04)

- ~~1.4.30 - Roadmap Rebaseline for 1.5.x Harness Series~~ (stable 2026-06-04)

- ~~1.4.31 - Workflow Closeout and Open-Phase Fixes~~ (stable 2026-06-04)

- ~~1.5.0 - Tidy Harness Skills and Hook Contracts~~ (stable 2026-06-04)

- ~~1.5.1 - Local Memory Persistence and Learning Queue~~ (stable 2026-06-04)

- ~~1.5.2 - AI Context Budget Audit~~ (stable 2026-06-04)

- ~~1.5.3 - Operational Skill Re-Architecture~~ (stable 2026-06-04)

- ~~1.5.4 - Session Checkpoint Deprecation~~ (stable 2026-06-04)

- ~~1.5.5 - Real Hook Guardrails~~ (stable 2026-06-04)

- ~~1.5.6 - Phase Eval Artifact Baseline~~ (stable 2026-06-04)

- ~~1.5.7 - Consolidated Closeout Packet~~ (stable 2026-06-04)

- ~~1.5.8 - Local Evidence Packet Code-Block Contract~~ (stable 2026-06-04)

- ~~1.6.0 - Ownership Failure Test Baseline~~ (stable 2026-06-04)

- ~~1.6.1 - List Item Ownership Fixes~~ (stable 2026-06-04)

- ~~1.6.2 - Reorder Target List Ownership Fix~~ (stable 2026-06-04)

- ~~1.6.3 - Ownership Regression Sweep~~ (stable 2026-06-04)

- ~~1.6.4 - Workflow Skill Evolution Sweep~~ (stable 2026-06-04)

- ~~1.6.5 - Codebase Graph Generator Stability Fix~~ (stable 2026-06-05)

- ~~1.6.6 - Phase Scoping and Opening Workflow Hardening~~ (stable 2026-06-05)

- ~~1.7.0 - Optimistic Queue Race Test Baseline~~ (stable 2026-06-05)

- ~~1.7.1 - Scope Rollback Rules~~ (stable 2026-06-05)

- ~~1.7.2 - Pending Mutation Cancellation Rules~~ (stable 2026-06-05)

- ~~1.7.3 - Refresh/Crash Pending Work Decision~~ (stable 2026-06-05)

- ~~1.8.0 - Local DB Role Audit Through Tests~~ (stable 2026-06-05)

- ~~1.8.1 - Scope-Output Opening-Sequence Template~~ (stable 2026-06-05)

- ~~1.8.2 - Script-Printed Command Re-Emit Hardening~~ (stable 2026-06-05)

- ~~1.8.3 - Post-Validation Closeout Enforcement~~ (stable 2026-06-05)

- ~~1.8.4 - Workflow Source-of-Truth Migration Into Skills~~ (stable 2026-06-05)

- ~~1.8.5 - Outbox Replay Integration Test Plan~~ (stable 2026-06-05)

- ~~1.8.6 - Offline Write Path Prototype~~ (stable 2026-06-05)

- ~~1.8.7 - Local-First Status Alignment and Roadmap Correction~~ (stable 2026-06-05)

- ~~1.9.0 - Dashboard Component Responsibility Audit~~ (stable 2026-06-05)

- ~~1.9.1 - Extract Dashboard Query Key Helper~~ (stable 2026-06-05)

- ~~1.9.2 - Extract List Mutation Cache Helpers~~ (stable 2026-06-05)

- ~~1.9.3 - Extract View Mutation Cache Helpers~~ (stable 2026-06-06)

- ~~1.9.4 - Extract Tag Mutation Cache Helpers~~ (stable 2026-06-06)

- ~~1.9.5 - Dashboard Mutation to Outbox Wiring~~ (stable 2026-06-06)

- ~~1.9.6 - Durable Pending-Write Integration~~ (stable 2026-06-06)

- ~~1.9.7 - Automatic Replay Worker~~ (stable 2026-06-06)

- ~~1.9.8 - Sync Status UI Surface~~ (stable 2026-06-06)

- ~~1.9.9 - Offline Conflict Resolution Rules~~ (stable 2026-06-06)

- ~~1.9.10 - Local DB Source-of-Truth Decision~~ (stable 2026-06-06)

- ~~1.9.11 - Product-First Planning Contract and Roadmap Rebaseline~~ (stable 2026-06-07)

- ~~1.9.12 - Agent Role-Model Realignment~~ (stable 2026-06-07)

- ~~1.9.13 - Stale Doc Content Sweep~~ (stable 2026-06-07)

- ~~1.9.14 - Version-History Ownership De-Dup~~ (stable 2026-06-07)

- ~~1.9.15 - Retire/Compress ai-harness Pointer Surface~~ (stable 2026-06-07)

- ~~1.9.16 - Dev-Gated Local-First Create List Slice~~ (stable 2026-06-08)

- ~~1.9.17 - Stabilize and Enable Local-First Create List Slice~~ (stable 2026-06-08)

- ~~1.9.18 - Roadmap Re-Plan Correction (SW-First Re-Sequence)~~ (stable 2026-06-09)

- ~~1.9.19 - Offline App-Shell (Service Worker)~~ (stable 2026-06-09)

- ~~1.9.20 - Dexie Read Fallback (API-Unavailable)~~ (stable 2026-06-10)

- ~~1.9.21 - Dexie<->Server Reconciliation & Lifecycle~~ (stable 2026-06-10)

- ~~1.9.22 - Bounded Batch Sync Endpoint & Server Apply~~ (stable 2026-06-10)

- ~~1.9.23 - Dexie-First List & Item CRUD~~ (stable 2026-06-10)

- ~~1.9.24 - Dexie-First Movement, Ordering & View-Switch Consistency~~ (stable 2026-06-11)

- ~~1.9.25 - Dexie-First Tags, Views & Relationships~~ (stable 2026-06-11)

- ~~1.9.26 - Batch Sync Lifecycle, Retry & Recovery~~ (stable 2026-06-12)

- ~~1.9.27 - Roadmap Re-Plan Correction (Overlay-First Re-Sequence)~~ (stable 2026-06-12)

- ~~1.9.28 - Dexie-First Reconcile Overlay~~ (stable 2026-06-12)

- ~~1.9.29 - Direct-Write Retirement & Default Dexie-First~~ (stable 2026-06-13)

- ~~1.9.30 - Delete Outbox Payload Validation Fix~~ (stable 2026-06-13)

- ~~1.9.31 - E2E Auth-Suite Sync-Timing Assertion Hardening~~ (stable 2026-06-13)

- ~~1.9.32 - Local-First Dashboard Architecture Closeout~~ (stable 2026-06-14)

- ~~1.10.0 - Copy and Metadata Hygiene~~ (stable 2026-06-14)

- ~~1.10.1 - Landing Page Branding Polish~~ (stable 2026-06-14)

- ~~2.0.0 - Replicache Read-Path Inversion (Local Store as Render Source)~~ (stable 2026-06-14)

- ~~2.0.1 - Fractional Indexing for Order~~ (stable 2026-06-14)

- ~~2.0.2 - Supabase Broadcast Realtime Poke~~ (stable 2026-06-14)

- ~~2.0.3 - Sharing & Permissions~~ (stable 2026-06-14)

- ~~2.0.4 - Replicache Pull Cookie Monotonicity Fix~~ (stable 2026-06-14)

- ~~2.0.5 - Share Redeem Error UX Hardening~~ (stable 2026-06-14)

- ~~2.0.6 - Yjs Collaborative Item Notes~~ (stable 2026-06-16)

- ~~2.0.7 - Realtime Poke Send Authorization~~ (stable 2026-06-16)

- ~~2.0.8 - Remove Dead Replicache License Config~~ (stable 2026-06-16)

- ~~2.0.9 - Retire Legacy Overlay / Outbox-Render / tRPC-Render Paths~~ (stable 2026-06-17)

- ~~2.1.0 - Deploy Env Documentation~~ (stable 2026-06-17)

- ~~2.1.1 - Build/Migration Readiness~~ (stable 2026-06-18)

- ~~2.1.2 - Production Smoke Checklist~~ (stable 2026-06-18)

- ~~2.2.0 - Visual Review Pass~~ (stable 2026-06-18)

- ~~2.2.1 - Retire test:e2e:replicache Render Gate~~ (stable 2026-06-18)

Pre-versioning (full detail in `docs/PHASE_LOG.md`):
- ~~Phase 1 - Dexie Foundation~~ (merged to master)
- ~~Phase 2 - Outbox Sync Queue~~ (ready for merge review)

---

## In Progress


---

## Planned

### 2.2.2 - View Create Idempotency Hardening
- **Status:** Open | Priority: P3 (repro-gated concurrency hardening)
- **Type:** product behavior
- **Files:** lib/sync/server-apply.ts (view `create` handler `tx.view.create`, ~line 1086); a regression test under tests/ reproducing a duplicate/concurrent view-create push.
- **Implementation goal:** FIRST confirm on a clean database whether a duplicate/concurrent view-create push can 500 on the unique `id` constraint. The sequential-replay path is ALREADY idempotent (the handler runs `tx.view.findUnique({ where: { id: entityClientId } })` and returns `already-applied` before inserting, lib/sync/server-apply.ts:1049-1057), so this phase targets only the residual concurrent same-id race between that check and `tx.view.create`. If reproduced, make the insert idempotent under concurrency (create->upsert on the primary key, or treat a unique-violation as `already-applied`).
- **Product impact:** none in the happy path; hardens the sync push handler against a duplicate/concurrent view-create 500.
- **Runtime integration target:** the /api/replicache/push server-apply view `create` case.
- **Deferral boundary:** if the 500 does NOT reproduce on a clean DB under concurrency, do not change server-apply - downgrade or close the phase and record the negative result. Scope only the view-create path; do not audit other server-apply creates.
- **Validation target:** targeted alpha (a regression test driving a duplicate/concurrent view-create asserting idempotent success, not 500); full test:ci before stable.
- **Acceptance:** either a reproduced concurrent view-create 500 is fixed with a regression test, or the phase records it does not reproduce and closes without a server-apply change.

### 2.2.3 - seriesComplete Flag Reconciliation
- **Status:** Open | Priority: P4 (workflow hygiene)
- **Type:** decision
- **Files:** STATE.json (`seriesComplete`), scripts/validate.ps1 (the nextPhase-ordering short-circuit), docs/VERSIONING.md and/or docs/WORKFLOW.md (document the decision).
- **Implementation goal:** decide and document what `seriesComplete` means once new patch phases are planned after a series was marked complete. It was set true at 2.0.9 for the 2.0 local-first arc and currently short-circuits validate.ps1's nextPhase-ordering checks, so 2.1.x/2.2.x promoted without them. Decide one of: (a) reset `seriesComplete=false` while 2.2.x phases remain Planned to re-enable the ordering checks, (b) scope the flag to "the 2.0 arc is complete" and document that it intentionally disables those checks, or (c) refine validate.ps1 so the flag does not disable ordering for an in-progress minor.
- **Product impact:** none - workflow tooling/validation only.
- **Runtime integration target:** none - validate.ps1 gating + STATE.json semantics.
- **Deferral boundary:** decision phase; if it changes validate.ps1, keep it minimal and covered by the existing consistency gate. Do not rewrite past phase records.
- **Validation target:** targeted alpha (validate.ps1 still passes; consistency gate green); full test:ci before stable.
- **Acceptance:** `seriesComplete` semantics are documented and STATE.json/validate.ps1 reflect the decision.

---

## Potential Next Directions (unversioned)

Assigned a version only when scoped.
- Investigate why open-phase.ps1/promote.ps1's committed codebase-graph.json (fallback generator) reads as stale against validate.ps1's freshness regeneration, so the Section 2 graph refresh is not needed on every phase (scripts/generate-codebase-graph.ps1, scripts/generate_codebase_graph.py, scripts/validate.ps1)
- Rate limiting and abuse controls
- Persistent sync idempotency ledger for duplicate-request auditability beyond semantic idempotency
- Observability
- Scale/performance profiling
- Order compaction
- PWA manifest, icon set, service-worker plan (app/layout.tsx, public/*)
- Mobile/touch drag-drop + responsive QA (components/list/*)
- Accessibility + UI polish pass (components/list/*, components/views/ViewsSidebarPreview.tsx)
- Sync or retire older root docs (docs/deprecated/*, README.md)
- Migration/backfill playbook (prisma/schema.prisma, prisma/migrations/*)
- Share tags and custom views with collaborators instead of projecting recipient shared lists with `listTags: []`.
- Allow recipients to place/reorder shared lists within their own All Lists/custom-view organization without materializing owner view state.
- Add rich-text item notes plus Yjs awareness/presence for remote cursors after the plain-text collaboration path is stable.
- Realtime poke delivery latency: shared changes propagate in ~20s while pull/push return 200. Hypothesis: the 2.0.3 realtime RLS added only a SELECT policy on realtime.messages, so the server REST broadcast cannot SEND to the private poke topic and the recipient falls back to the 60s pullInterval. (lib/realtime/poke-server.ts, prisma/sql/2_0_3_realtime_poke_rls.sql, lib/sync/replicache/client.ts)

---

## Discarded / Won't Do

- **1.10.1 - Auth Flow Copy Polish - retired 2026-06-14.** Its only deliverable, the Register submit button reading "Login", already shipped in commit 2489cae (the button reads "Register"); the driving Known Risk was stale. The phase is removed and the former "1.10.2 - Landing Page Branding Polish" is renumbered down to 1.10.1 to keep the patch sequence gapless. No work item is dropped.
- **1.9.x server-authoritative render + pending-outbox overlay as the local-first UX path** - superseded 2026-06-14. Rendering from the tRPC server payload plus `lib/local-db/local-overlay.ts`, with Dexie only as an offline fallback, leaves the optimistic / overlay / refetch three-way race (the perceived flicker). The 2.0 arc replaces it with a Replicache local-store render; the overlay / outbox-render / tRPC-render paths are retired in 2.0.7. The Dexie-first WRITE path and bounded batch sync are NOT discarded - those concepts carry forward into Replicache's push handler. See `docs/DECISIONS.md` (2026-06-14).
- **Roadmap renumber (2026-06-14):** old 1.11.0-1.11.2 polish pulled forward to 1.10.0-1.10.2; old 1.10.0-1.10.2 deploy readiness pushed to 2.1.0-2.1.2 and old 1.11.3 visual review to 2.2.0, so deployment docs are written once against the 2.0 architecture. No work item is dropped; only resequenced.
- **Roadmap renumber (2026-06-14, post-2.0.3 R9):** inserted 2.0.4 - Replicache Pull Cookie Monotonicity Fix ahead of the collaboration work after R9 verification exposed a latent pull-cookie lexicographic-ordering bug. 2.0.4 Yjs Collaborative Item Notes -> 2.0.5; 2.0.5 Retire Legacy paths -> 2.0.6 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-14, post-2.0.4 R9):** inserted 2.0.5 - Share Redeem Error UX Hardening ahead of the collaboration work after R9 surfaced a revoked-link redemption UX failure (unhandled rejection on the /share redeem page). Yjs Collaborative Item Notes 2.0.5 -> 2.0.6; Retire Legacy paths 2.0.6 -> 2.0.7 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-16):** inserted 2.0.7 - Realtime Poke Send Authorization ahead of the cleanup work to fix shared-rename propagation latency (the server poke could not send because realtime.messages RLS, enabled in 2.0.6, blocks the anon key on INSERT). Retire Legacy paths 2.0.7 -> 2.0.8 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.
- **Roadmap renumber (2026-06-16, dead-config carve-out):** carved the dead `licenseKey` / `NEXT_PUBLIC_REPLICACHE_LICENSE_KEY` removal out of the retirement phase into a new small 2.0.8 - Remove Dead Replicache License Config. Retire Legacy paths 2.0.8 -> 2.0.9 (seriesComplete still flips at the renumbered Retire phase). No work item dropped; only resequenced.

---

## Known Cross-Cutting Risks

- Optimistic queue mechanics are baselined by `tests/unit/optimistic-sync-baseline.test.ts` (1.7.1); broader cross-component optimistic race behavior and blind snapshot rollback containment are still not fully proven.
- The reconciled Dexie fallback is structurally complete, but offline freshness is bounded by the last successful server seed and pending local work.
- Direct dashboard tRPC persistence is retired and Dexie-first writes are default-on in 1.9.29; phase acceptance remains blocked on online read correctness.
- 1.9.26 adds backoff-ready `failed` selection and stranded `syncing` recovery; cross-tab flush coordination remains a follow-up.
- Retiring direct tRPC persistence before a generalized pending overlay lets settling/refocused dashboard queries clobber unsynced optimistic create/tag/view entries; the 1.9.28 overlay closes this and is a hard prerequisite for 1.9.29.
- The 1.9.28 online overlay does not yet keep locally-created entities visible across the flush-to-server-confirmed window; list presence, `listTags`/tag rendering, and a performance-safe local refresh are the remaining 1.9.29 work.
- Large components increase risk for focused changes.
- Frontend projection and backend refresh must agree before UI/UX polish.

