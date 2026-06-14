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

Pre-versioning (full detail in `docs/PHASE_LOG.md`):
- ~~Phase 1 - Dexie Foundation~~ (merged to master)
- ~~Phase 2 - Outbox Sync Queue~~ (ready for merge review)

---

## In Progress


- 1.10.1 - Landing Page Branding Polish (active) - see Planned
---

## Planned

### 1.10.1 - Auth Flow Copy Polish
- **Status:** Open | Priority: P3 quick polish (pulled forward from 1.11.1)
- **Type:** product behavior (polish)
- **Files:** components/auth/Register.tsx, auth components if needed
- **Implementation goal:** fix misleading auth copy such as the Register submit button saying "Login".
- **Product impact:** clearer auth copy; auth behavior unchanged.
- **Runtime integration target:** none beyond copy.
- **Deferral boundary:** landing copy -> 1.10.2.
- **Validation target:** targeted alpha (copy checks + manual proof); full test:ci before stable.
- **Acceptance:** copy is clear; auth behavior unchanged.

### 1.10.2 - Landing Page Branding Polish
- **Status:** Open | Priority: P3 quick polish (pulled forward from 1.11.2)
- **Type:** product behavior (polish)
- **Files:** app/page.tsx
- **Implementation goal:** fix the landing typo and improve lightweight Tidy positioning.
- **Product impact:** improved landing copy; no behavior change.
- **Runtime integration target:** none beyond copy.
- **Deferral boundary:** broader visual review -> 2.2.0 (post-2.0).
- **Validation target:** targeted alpha (copy checks + manual proof); full test:ci before stable.
- **Acceptance:** copy improves without changing app behavior.

### 2.0.0 - Replicache Read-Path Inversion (Local Store as Render Source)
- **Status:** Open | Priority: P1 2.0 local-first render
- **Type:** product behavior
- **Files:** lib/sync/*, lib/dashboard-cache.ts, app/api/* (push / pull), components/list/*, prisma/schema.prisma (Replicache client / version tracking)
- **Implementation goal:** adopt Replicache as the sync spine - one local store, deterministic mutators applied optimistically, batched `/push`, diff `/pull`, client rebase; the dashboard reads the local store via reactive queries and never a raw server payload.
- **Product impact:** immediate local-first render; the optimistic / overlay / refetch flicker is eliminated.
- **Runtime integration target:** dashboard renders from the Replicache local store; `/push` reuses `lib/sync/server-apply.ts`; Postgres / Prisma remain the durable source.
- **Deferral boundary:** order representation -> 2.0.1; realtime poke -> 2.0.2; legacy overlay / outbox-render removal -> 2.0.5.
- **Validation target:** targeted alpha + manual local-first render proof; full test:ci before stable.
- **Acceptance:** create / edit / move renders instantly from the local store with no flicker; server rejections surface as background corrections, not UI rollbacks.

### 2.0.1 - Fractional Indexing for Order
- **Status:** Open | Priority: P1 2.0 local-first render
- **Type:** product behavior
- **Files:** lib/sync/*, lib/dashboard-cache.ts, components/list/*, prisma/schema.prisma (order columns)
- **Implementation goal:** replace coarse `orderedIds` reorder operations with client-generated fractional indices for list, item, and view order.
- **Product impact:** conflict-friendly local reordering without full-list reorder operations.
- **Runtime integration target:** order is a local fractional value reconciled per entity; reorder no longer ships an ordered-id array.
- **Deferral boundary:** realtime convergence across clients -> 2.0.2.
- **Validation target:** targeted alpha + manual reorder proof; full test:ci before stable.
- **Acceptance:** reorder is represented by fractional indices and survives concurrent edits deterministically.

### 2.0.2 - Supabase Broadcast Realtime Poke
- **Status:** Open | Priority: P1 2.0 realtime
- **Type:** product behavior
- **Files:** lib/sync/*, app/api/sync/route.ts, lib/realtime/* (new), components/*
- **Implementation goal:** emit one Supabase Broadcast message per `/api/sync` batch ("changed, cursor=N") on a per-workspace / list channel; receivers PULL the delta. Doorbell, not delivery.
- **Product impact:** near-real-time multi-client / multi-tab convergence.
- **Runtime integration target:** a batch flush pokes the channel; receivers pull; missed messages self-heal on the next pull.
- **Deferral boundary:** multi-user access control -> 2.0.3.
- **Validation target:** targeted alpha + manual two-client convergence proof; full test:ci before stable.
- **Acceptance:** a change in one client appears in another via poke + pull without per-row CDC.

### 2.0.3 - Sharing & Permissions
- **Status:** Open | Priority: P1 2.0 collaboration
- **Type:** product behavior
- **Files:** prisma/schema.prisma, trpc/routers/*, lib/sync/server-apply.ts, app/api/*
- **Implementation goal:** introduce shared workspaces / lists with per-user permissions enforced server-side in push / pull and the broadcast channel scope.
- **Product impact:** users can share lists and collaborate.
- **Runtime integration target:** push / pull and broadcast are permission-scoped; ownership checks remain server-authoritative.
- **Deferral boundary:** live text co-editing -> 2.0.4.
- **Validation target:** targeted alpha + ownership / permission tests + manual proof; full test:ci before stable.
- **Acceptance:** only permitted users can read / write a shared list; unauthorized push / pull is rejected.

### 2.0.4 - Yjs Collaborative Item Notes
- **Status:** Open | Priority: P2 2.0 collaboration
- **Type:** product behavior
- **Files:** components/list/*, lib/collab/* (new Yjs provider), prisma/schema.prisma (binary note doc), app/api/*
- **Implementation goal:** add live concurrent co-editing of item NOTES only via per-field `Y.Doc` keyed by item id, persisted as binary in Postgres, synced through its own provider. Structure stays server-authoritative + per-entity LWW.
- **Product impact:** real-time collaborative note editing on items.
- **Runtime integration target:** item notes are a CRDT field; names and structure remain LWW.
- **Deferral boundary:** does NOT convert names or relational structure to CRDTs.
- **Validation target:** targeted alpha + manual concurrent-edit proof; full test:ci before stable.
- **Acceptance:** two users editing the same item note converge without lost text.

### 2.0.5 - Retire Legacy Overlay / Outbox-Render / tRPC-Render Paths
- **Status:** Open | Priority: P1 2.0 cleanup
- **Type:** cleanup
- **Files:** lib/local-db/local-overlay.ts, lib/dashboard-cache.ts, hooks/useOptimisticSync.ts, lib/sync/offline-write-prototype.ts, components/*
- **Implementation goal:** remove the 1.9.x pending-outbox overlay, the outbox-as-render-source fallback, and the server-payload tRPC render path now superseded by Replicache; retire the `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` gate.
- **Product impact:** none beyond removing dead / duplicate render paths; render is wholly local-store driven.
- **Runtime integration target:** only the Replicache render / sync path remains.
- **Deferral boundary:** none - final 2.0 architecture cleanup. This is the phase that flips `seriesComplete = true`.
- **Validation target:** full test:ci + manual regression of the dashboard; full validate.ps1 before stable.
- **Acceptance:** the legacy overlay / outbox-render / tRPC-render paths are gone and the dashboard still passes the full suite; `seriesComplete` flips true.

### 2.1.0 - Deploy Env Documentation
- **Status:** Open | Priority: P2 production readiness (pushed back from 1.10.0; deploy docs written once against the 2.0 architecture)
- **Type:** docs
- **Files:** README.md, .env.example
- **Implementation goal:** document DATABASE_URL, Supabase env vars (incl. Broadcast / Replicache), site URL, and local / prod differences.
- **Product impact:** none - enables correct deployment.
- **Runtime integration target:** none.
- **Deferral boundary:** build / migration path -> 2.1.1.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** a new setup can follow the docs without guessing.

### 2.1.1 - Build/Migration Readiness
- **Status:** Open | Priority: P2 production readiness (pushed back from 1.10.1)
- **Type:** docs
- **Files:** README.md, prisma/*, package.json only if needed
- **Implementation goal:** document Prisma generate, migration, and build steps (including any Replicache / Yjs persistence migrations) for a repeatable release path.
- **Product impact:** none - enables repeatable releases.
- **Runtime integration target:** none.
- **Deferral boundary:** smoke checklist -> 2.1.2.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** the production build / migration flow is clear and repeatable.

### 2.1.2 - Production Smoke Checklist
- **Status:** Open | Priority: P2 production readiness (pushed back from 1.10.2)
- **Type:** docs
- **Files:** README.md, docs/FUTURE_PLANS.md
- **Implementation goal:** document a small post-deploy smoke checklist (login, dashboard load, create list / item, tag view, reorder, refresh, two-client sync).
- **Product impact:** none - guards releases.
- **Runtime integration target:** none.
- **Deferral boundary:** does not duplicate full test docs.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** a smoke checklist exists and does not duplicate full test docs.

### 2.2.0 - Visual Review Pass
- **Status:** Open | Priority: P3 late UI/UX (pushed back from 1.11.3)
- **Type:** product behavior (polish)
- **Files:** components/list/*, components/views/ViewsSidebarPreview.tsx, app/page.tsx
- **Implementation goal:** small visual review pass after the 2.0 local-first render and collaboration are stable.
- **Product impact:** small visual improvements; no data behavior change.
- **Runtime integration target:** none beyond presentation.
- **Deferral boundary:** none - last polish phase.
- **Validation target:** targeted alpha (visual review + manual proof); full test:ci before stable.
- **Acceptance:** visual changes are small, reviewable, and do not alter data behavior.

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

---

## Discarded / Won't Do

- **1.9.x server-authoritative render + pending-outbox overlay as the local-first UX path** - superseded 2026-06-14. Rendering from the tRPC server payload plus `lib/local-db/local-overlay.ts`, with Dexie only as an offline fallback, leaves the optimistic / overlay / refetch three-way race (the perceived flicker). The 2.0 arc replaces it with a Replicache local-store render; the overlay / outbox-render / tRPC-render paths are retired in 2.0.5. The Dexie-first WRITE path and bounded batch sync are NOT discarded - those concepts carry forward into Replicache's push handler. See `docs/DECISIONS.md` (2026-06-14).
- **Roadmap renumber (2026-06-14):** old 1.11.0-1.11.2 polish pulled forward to 1.10.0-1.10.2; old 1.10.0-1.10.2 deploy readiness pushed to 2.1.0-2.1.2 and old 1.11.3 visual review to 2.2.0, so deployment docs are written once against the 2.0 architecture. No work item is dropped; only resequenced.

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

