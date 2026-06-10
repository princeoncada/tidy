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

Pre-versioning (full detail in `docs/PHASE_LOG.md`):
- ~~Phase 1 - Dexie Foundation~~ (merged to master)
- ~~Phase 2 - Outbox Sync Queue~~ (ready for merge review)

---

## In Progress


---

## Planned

### 1.9.21 - Dexie<->Server Reconciliation & Lifecycle
- **Status:** Open | Priority: P1 product (local-first)
- **Type:** product behavior
- **Files:** hooks/useLocalFirstDashboardBoot.ts, lib/local-first-dashboard.ts, lib/local-db/*, components/list/ListsContainer.tsx, tests
- **Implementation goal:** make the local dashboard graph complete and deterministic before it is rendered. Seed and reconcile views, lists, list items, tags, list-tags, view-tags, view-list membership, and ordering; deduplicate client/server identities; remove stale synced rows without deleting pending local work; and activate the fallback only after API unavailability is known instead of during normal query loading.
- **Product impact:** list cards and their items render in the correct list immediately. Normal online loading no longer flashes empty, duplicated, stale, or temporarily misplaced list items before the server response settles.
- **Runtime integration target:** one reconciled Dexie dashboard graph produces structurally complete snapshots (`listItems`, tags, membership, and order always defined), while pending local rows survive server seeding and the server payload refreshes only acknowledged/synced rows.
- **Deferral boundary:** this phase fixes read correctness and lifecycle only. The real batch server-apply contract is 1.9.22; Dexie-first writes begin in 1.9.23.
- **Validation target:** targeted alpha (graph reconciliation/dedup, pending-row preservation, API-loading-vs-unavailable state tests, rapid-create/reload E2E, and screenshot-sequence manual proof); full test:ci before stable.
- **Acceptance:** rapid create, item movement, view switching, reload, and delayed API responses never show duplicate keys, undefined/empty item collections, or an item under the wrong list; API-unavailable fallback still renders the complete local graph.

### 1.9.22 - Bounded Batch Sync Endpoint & Server Apply
- **Status:** Open | Priority: P1 infrastructure (local-first)
- **Type:** infrastructure
- **Files:** app/api/sync/route.ts, lib/sync/sync-endpoint-contract.ts, lib/local-db/sync-replay-client.ts, trpc/routers/* or dedicated server sync modules, tests
- **Implementation goal:** replace the acknowledge-only, one-operation transport with a real authenticated batch contract accepting `operations[]` in one bounded request. Validate user scope, ownership, dependency order, payload count/bytes, idempotency keys, and operation types; apply accepted mutations to PostgreSQL; and return a result for every submitted operation.
- **Product impact:** none by itself - this is the required server half of the Dexie-first write path and prevents local operations from being marked synced when the database was never changed.
- **Runtime integration target:** one flush sends one HTTP request containing a bounded coalesced operation batch. The endpoint actually applies the batch, preserves existing short-transaction and batch-SQL invariants, and acknowledges only operations durably applied or already applied idempotently.
- **Deferral boundary:** dashboard components still use their existing mutation paths until the local write migrations in 1.9.23-1.9.25. Flush scheduling and full direct-tRPC retirement finish in 1.9.26.
- **Validation target:** targeted alpha (contract limits, auth/ownership, idempotency, dependency ordering, atomic failure behavior, database-apply integration, and request-count tests); full test:ci before stable.
- **Acceptance:** several queued operations are persisted by one `/api/sync` request; the database reflects them; replay cannot report success for an unapplied operation; rejected operations remain retryable or surface a permanent error explicitly.

### 1.9.23 - Dexie-First List & Item CRUD
- **Status:** Open | Priority: P1 product (local-first)
- **Type:** product behavior
- **Files:** lib/local-db/*, lib/dashboard-cache.ts, components/list/ListAdder.tsx, components/list/ListComponent.tsx, components/list/ListItemComponent.tsx, tests
- **Implementation goal:** route list and item create, rename, complete/uncomplete, notes, and delete through one atomic local transaction that updates the Dexie entity graph and appends/coalesces an outbox operation before the UI treats the action as committed.
- **Product impact:** list and item changes are immediate, survive refresh/offline use, and no longer wait on or emit a direct tRPC mutation per action.
- **Runtime integration target:** Dexie is the runtime authority for migrated list/item CRUD; TanStack is a projection/render cache; the batch sync worker is the only remote persistence path for these migrated operations.
- **Deferral boundary:** list/item movement and ordering are 1.9.24; tags and custom views are 1.9.25; final removal of legacy direct writes and lifecycle proof is 1.9.26.
- **Validation target:** targeted alpha (local transaction/outbox atomicity, create-parent/create-child dependency, refresh/offline durability, delete recovery, and network request-count E2E); full test:ci before stable.
- **Acceptance:** multiple list/item edits produce local state immediately and reach PostgreSQL through a later single batch request, with no component-level tRPC mutation for migrated actions.

### 1.9.24 - Dexie-First Movement, Ordering & View-Switch Consistency
- **Status:** Open | Priority: P1 product (local-first)
- **Type:** product behavior
- **Files:** components/list/ListsContainer.tsx, components/views/ViewsSidebarPreview.tsx, lib/local-db/*, lib/dashboard-cache.ts, tests
- **Implementation goal:** persist committed list, item, and custom-view reorder/move operations to Dexie/outbox instead of calling tRPC after each drop. Preserve local-only drag hover, coalesce newest-state-wins reorder intents, and overlay pending local movement during view fetch/reconciliation so stale server projections cannot temporarily move an item back.
- **Product impact:** moving an item or list remains correct while switching views, waiting for sync, going offline, or reloading. A completed drop does not immediately create its own network request.
- **Runtime integration target:** each drop creates one local reorder/move intent; repeated movement coalesces locally; the next batch flush persists the final state with existing ownership and batch-SQL protections.
- **Deferral boundary:** tags/custom views CRUD are 1.9.25; lifecycle triggers and final request-spam proof are 1.9.26.
- **Validation target:** targeted alpha (same-list reorder, cross-list move, empty-list move, rapid repeated drops, view-switch-before-flush, reload-before-flush, and request-count E2E); full test:ci before stable.
- **Acceptance:** movement is immediately and durably correct from Dexie, stale server payloads cannot repaint old placement, and several drops are represented by coalesced operations in one later sync request.

### 1.9.25 - Dexie-First Tags, Views & Relationships
- **Status:** Open | Priority: P1 product (local-first)
- **Type:** product behavior
- **Files:** components/list/ListTagPicker.tsx, components/views/ViewsSidebarPreview.tsx, lib/local-db/*, lib/dashboard-cache.ts, tests
- **Implementation goal:** migrate tag, list-tag, view, view-tag, selected-view, and view-list relationship writes to the same Dexie/outbox transaction contract, preserving custom-view projection and latest-selection invariants.
- **Product impact:** the remaining dashboard actions are immediate and durable locally instead of generating direct per-action tRPC writes.
- **Runtime integration target:** all persisted dashboard entities and relationships use Dexie-first writes and the bounded batch endpoint.
- **Deferral boundary:** final worker lifecycle, retry policy, legacy direct-write removal, and full end-to-end proof are 1.9.26.
- **Validation target:** targeted alpha (tag/view CRUD, rapid tag toggles, custom-view projection, selected-view races, offline refresh, and request-count E2E); full test:ci before stable.
- **Acceptance:** list/tag/view workflows remain correct while their remote persistence is performed only through batched sync.

### 1.9.26 - Batch Sync Lifecycle, Retry & Direct-Write Retirement
- **Status:** Open | Priority: P1 product (local-first)
- **Type:** product behavior
- **Files:** hooks/use-offline-replay-trigger.ts, lib/sync/*, lib/local-db/*, dashboard mutation components, tests
- **Implementation goal:** finish the production sync lifecycle: flush after a bounded quiet window or batch-size threshold, on reconnect, and on safe lifecycle opportunities; prevent concurrent flushes; retry transient failures with backoff; recover stranded `syncing`/`failed` operations; and remove remaining component-level direct tRPC persistence for dashboard mutations.
- **Product impact:** normal interaction produces local updates without request spam, then synchronizes multiple changes in one bounded request with visible pending/error state.
- **Runtime integration target:** Dexie is the primary local dashboard source, PostgreSQL/Supabase is the remote durable source, and `/api/sync` batch flushes are the single remote write path for dashboard state.
- **Deferral boundary:** no dashboard CRUD or movement slice may remain on direct tRPC persistence. The architecture closeout decision is 1.9.27.
- **Validation target:** targeted alpha (flush timing/thresholds, retry/backoff, crash/reload recovery, concurrent-trigger suppression, request-count assertions, and full manual multi-action proof); full test:ci before stable.
- **Acceptance:** a representative multi-action session updates instantly from Dexie and reaches the server in bounded batch requests rather than one request per action; all acknowledged operations survive reload and match PostgreSQL.

### 1.9.27 - Local-First Dashboard Architecture Closeout
- **Status:** Open | Priority: P1 decision
- **Type:** decision
- **Files:** docs/DECISIONS.md, docs/AI_HANDOFF.md, docs/FUTURE_PLANS.md
- **Implementation goal:** evaluate the shipped reconciled read graph, Dexie-first dashboard writes, and bounded server batch sync; record residual limitations and whether the 1.9.x local-first series is complete.
- **Product impact:** none directly - closes the architecture only after both requested product outcomes have shipped and been proven.
- **Runtime integration target:** none (decision); records the delivered runtime contract and names any follow-up outside dashboard local-first behavior.
- **Deferral boundary:** production-readiness work remains in 1.10.x; no missing dashboard mutation may be silently deferred through this decision.
- **Validation target:** targeted alpha (validate.ps1 + decision recorded); full validate.ps1 at the gate.
- **Acceptance:** the decision records proof that immediate list/item correctness and Dexie-first bounded batch sync are delivered, or keeps `seriesComplete` false with an explicitly versioned remaining product phase.

### 1.10.0 - Deploy Env Documentation
- **Status:** Open | Priority: P2 production readiness
- **Type:** docs
- **Files:** README.md, .env.example
- **Implementation goal:** document DATABASE_URL, Supabase env vars, site URL, and local/prod differences so deployment expectations are clear.
- **Product impact:** none - enables correct deployment.
- **Runtime integration target:** none.
- **Deferral boundary:** build/migration path -> 1.10.1.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** a new setup can follow the docs without guessing.

### 1.10.1 - Build/Migration Readiness
- **Status:** Open | Priority: P2 production readiness
- **Type:** docs
- **Files:** README.md, prisma/*, package.json only if needed
- **Implementation goal:** document Prisma generate, migration, and build steps for a repeatable release path.
- **Product impact:** none - enables repeatable releases.
- **Runtime integration target:** none.
- **Deferral boundary:** smoke checklist -> 1.10.2.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** the production build/migration flow is clear and repeatable.

### 1.10.2 - Production Smoke Checklist
- **Status:** Open | Priority: P2 production readiness
- **Type:** docs
- **Files:** README.md, docs/FUTURE_PLANS.md
- **Implementation goal:** document a small post-deploy smoke checklist (login, dashboard load, create list, create item, tag view, reorder, refresh).
- **Product impact:** none - guards releases.
- **Runtime integration target:** none.
- **Deferral boundary:** does not duplicate full test docs.
- **Validation target:** targeted alpha (doc presence checks); full validate.ps1 at the gate.
- **Acceptance:** a smoke checklist exists and does not duplicate full test docs.

### 1.11.0 - Copy and Metadata Hygiene
- **Status:** Open | Priority: P3 late polish
- **Type:** product behavior (polish)
- **Files:** app/layout.tsx, public/*, README.md if needed
- **Implementation goal:** fix missing asset references and metadata consistency.
- **Product impact:** correct metadata/asset references; no behavior change.
- **Runtime integration target:** metadata references existing assets.
- **Deferral boundary:** auth copy -> 1.11.1; landing copy -> 1.11.2.
- **Validation target:** targeted alpha (asset/metadata checks + manual proof); full test:ci before stable.
- **Acceptance:** metadata references existing assets; no behavior change.

### 1.11.1 - Auth Flow Copy Polish
- **Status:** Open | Priority: P3 late polish
- **Type:** product behavior (polish)
- **Files:** components/auth/Register.tsx, auth components if needed
- **Implementation goal:** fix misleading auth copy such as the Register submit language.
- **Product impact:** clearer auth copy; auth behavior unchanged.
- **Runtime integration target:** none beyond copy.
- **Deferral boundary:** landing copy -> 1.11.2.
- **Validation target:** targeted alpha (copy checks + manual proof); full test:ci before stable.
- **Acceptance:** copy is clear; auth behavior unchanged.

### 1.11.2 - Landing Page Branding Polish
- **Status:** Open | Priority: P3 late polish
- **Type:** product behavior (polish)
- **Files:** app/page.tsx
- **Implementation goal:** fix the typo and improve lightweight Tidy positioning on the landing page.
- **Product impact:** improved landing copy; no behavior change.
- **Runtime integration target:** none beyond copy.
- **Deferral boundary:** broader visual review -> 1.11.3.
- **Validation target:** targeted alpha (copy checks + manual proof); full test:ci before stable.
- **Acceptance:** copy improves without changing app behavior.

### 1.11.3 - Visual Review Pass
- **Status:** Open | Priority: P3 late UI/UX
- **Type:** product behavior (polish)
- **Files:** components/list/*, components/views/ViewsSidebarPreview.tsx, app/page.tsx
- **Implementation goal:** perform a small visual review pass only after state correctness, ownership, optimistic behavior, and tests are stable.
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

(none recorded yet)

---

## Known Cross-Cutting Risks

- Optimistic queue mechanics are baselined by `tests/unit/optimistic-sync-baseline.test.ts` (1.7.1); broader cross-component optimistic race behavior and blind snapshot rollback containment are still not fully proven.
- The 1.9.20 local fallback is structurally incomplete (views/lists only, empty mapped `listItems`) and can activate during ordinary API loading; 1.9.21 owns this correctness gate.
- Most dashboard actions still persist through direct tRPC mutations, so the app does not yet satisfy Dexie-first writes or bounded multi-action synchronization.
- The current replay transport sends one request per operation, while `/api/sync` acknowledges without applying database changes. It must not be treated as production sync before 1.9.22.
- Failed replay operations can become stranded because replay selects `pending` rows while failures are marked `failed`; lifecycle recovery is required by 1.9.26.
- Large components increase risk for focused changes.
- Frontend projection and backend refresh must agree before UI/UX polish.

