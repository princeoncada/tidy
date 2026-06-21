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


---

## Planned

**3.0 Collaboration Arc - Context (orientation, not a phase)**

Arc goal: evolve Tidy from a personal list app into a small-team PM collaboration tool, kept portfolio-grade.

Architecture spine (invariant across the arc):
- One Replicache sync spine serves both web and the future Expo/React Native client (4.0).
- Structural sync (lists/items/board via Replicache) and ephemeral presence (cursors/typing/who-is-here) ride SEPARATE transports; presence must not be coupled into the Replicache push/pull path.
- The existing workspace model is KEPT, not replaced.
- UI/design is governed by docs/design.md (created in 3.0.4) as the single source of truth.

Execution discipline (anti-loop rails):
- Spike before commit: 3.1.0 and 3.4.0 are throwaway measurement/feasibility spikes that produce the scope for the phase after them.
- Measure before fix (3.1.1 scopes from 3.1.0); data before visualization (3.4.4 reads real synced data first).
- Flag-gate risky product surfaces; every flag declares default, dev path, activation, and removal.
- Done = a named proof (test or manual product proof), never "looks done".

### 3.2.8 - Concurrent-Pull Resilience & Fast-Switch View Convergence
- **Status:** Open
- **Type:** infrastructure
- **Implementation goal:** Harden the Replicache pull path against concurrent pulls during rapid view create/switch. `buildReplicacheClientView` (`lib/sync/replicache/pull-cvr.ts`, ~line 69) throws `Cannot read properties of undefined (reading 'length')` on `list.listItems`, returning a 500 from `/api/replicache/pull` (reproduced at Playwright `--workers=2`; green single-worker). Add null-safety/normalization to the pull list shape so a list with no joined items pulls cleanly, and resolve the `selectedView` convergence so `tests/e2e/views.spec.ts` "latest selected view wins after fast switching" passes deterministically under concurrent pulls.
- **Product impact:** none directly - removes intermittent pull-path 500s and the fast-switch selected-view race; no UI change.
- **Runtime integration target:** the Replicache pull path (`lib/sync/replicache/pull-cvr.ts`, `app/api/replicache/pull/route.ts`) and selected-view convergence (`hooks/useReplicacheDashboard.ts` if needed).
- **Deferral boundary:** no change to the pull/CVR wire contract beyond null-safety; create-path idempotency is 3.2.9 (TOCTOU); no projection or ordering semantic change.
- **Validation target:** targeted unit coverage for the empty-/missing-`listItems` pull shape; `tests/e2e/views.spec.ts` fast-switch passes at `--workers=2`; the previously flaky `tests/e2e/drag-drop.spec.ts` "reorder lists in a custom view" no longer triggers the pull-cvr crash.
- **Files:** lib/sync/replicache/pull-cvr.ts, app/api/replicache/pull/route.ts, hooks/useReplicacheDashboard.ts (selectedView convergence, if needed), tests/e2e/views.spec.ts, tests; exact files confirmed at scope time

### 3.2.9 - Create-Path Idempotency Hardening (TOCTOU)
- **Status:** Open
- **Type:** infrastructure
- **Implementation goal:** Close the `findUnique` -> `create` TOCTOU shared by every create case in `lib/sync/server-apply.ts` (view, list, item, tag) with a transaction-abort-aware fix (atomic `INSERT ... ON CONFLICT` / upsert, or `ROLLBACK TO SAVEPOINT` recovery) so a post-reload client replay racing the original push cannot 500.
- **Product impact:** none directly - removes intermittent `tx.*.create` P2002 (`Unique constraint failed on the fields: (id)`) 500s under concurrent same-id pushes; not tied to any UI phase.
- **Runtime integration target:** the Replicache push apply path (`lib/sync/server-apply.ts`) inside the existing Prisma transaction.
- **Deferral boundary:** no change to the Replicache wire contract, projection, ordering, or any UI; absorbs the former view-create idempotency Potential Next Direction.
- **Validation target:** a real-Postgres integration harness proving concurrent same-id create returns `already-applied` (not P2002); targeted unit coverage; previously surfaced only in the authenticated Playwright suite under reload-replay.
- **Files:** lib/sync/server-apply.ts, prisma/schema.prisma (only if a constraint/index change is needed), tests

### 3.3.0 - Item Detail Panel & Notes
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Notion-style item detail panel hosting the existing Yjs notes + item metadata.
- **Product impact:** user-visible item panel.
- **Runtime integration target:** panel opens from list/board items; notes use the existing Yjs path.
- **Deferral boundary:** Status/assignee properties are 3.3.1; board is 3.4.1.
- **Validation target:** targeted + manual product proof (open panel, edit notes); preserve Yjs invariants.
- **Files:** components/item/* (new panel), existing notes integration

### 3.3.1 - Item Properties (Status & Assignee)
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Add structured item properties (status, assignee) synced via Replicache.
- **Product impact:** user-visible item properties.
- **Runtime integration target:** properties sync through the Replicache spine.
- **Deferral boundary:** Board grouping on status is 3.4.1; presence is 3.4.x.
- **Validation target:** targeted + manual product proof; schema/migration if needed.
- **Files:** prisma/schema.prisma (+migration), lib/sync/*, components/item/*

### 3.4.0 - Presence Transport Spike
- **Status:** Open
- **Type:** decision (spike)
- **Implementation goal:** Spike the ephemeral-presence transport (cursors/typing/who-is-here) SEPARATE from Replicache; choose the mechanism and prove feasibility.
- **Product impact:** none - spike.
- **Runtime integration target:** none - chosen transport feeds 3.4.3.
- **Deferral boundary:** No production presence UI here; board is 3.4.1.
- **Validation target:** spike decision record (transport choice + proof).
- **Files:** lib/realtime/* (spike), docs/ (decision)

### 3.4.1 - Multiplayer Board
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** The flagship multiplayer board view (grouped items, drag across columns) on the Replicache spine.
- **Product impact:** major user-visible board.
- **Runtime integration target:** board renders + writes through Replicache; flag-gated rollout.
- **Deferral boundary:** Live presence overlays are 3.4.3; sharing UX is 3.4.2; progress rollups are 3.4.4.
- **Validation target:** targeted + manual product proof (two-user board); preserve DnD/order invariants.
- **Files:** components/board/* (new), lib/sync/*

### 3.4.2 - Collaboration & Sharing UX
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Polished sharing/collaboration UX over the existing permissions model (invite/redeem/roles surfaced in the new shell).
- **Product impact:** user-visible sharing flows.
- **Runtime integration target:** uses lib/sync/permissions.ts + share redeem.
- **Deferral boundary:** Live presence is 3.4.3; no new permission model.
- **Validation target:** targeted + manual product proof (share + redeem).
- **Files:** components/share/*, lib/sync/permissions.ts

### 3.4.3 - Live Presence
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Implement live presence (cursors/typing/who-is-here) using 3.4.0's chosen transport, on the board + panel.
- **Product impact:** user-visible presence.
- **Runtime integration target:** presence transport runs alongside Replicache, not through it.
- **Deferral boundary:** Progress rollups are 3.4.4; transport scope is fixed by 3.4.0.
- **Validation target:** targeted + manual product proof (two-user presence).
- **Files:** lib/realtime/*, components/board/*, components/item/*

### 3.4.4 - Board Progress & Rollups
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Progress/rollup surfaces for the board (completion %, per-column counts) computed from real synced data.
- **Product impact:** user-visible progress.
- **Runtime integration target:** rollups read live Replicache state (data-before-visualization).
- **Deferral boundary:** No version history (3.5.x).
- **Validation target:** targeted + manual product proof.
- **Files:** components/board/*, lib/*

### 3.5.0 - Mutation Ledger
- **Status:** Open
- **Type:** infrastructure
- **Implementation goal:** Persist an append-only mutation ledger (who/what/when) as the substrate for history.
- **Product impact:** none directly - enables 3.5.1/3.5.2.
- **Runtime integration target:** ledger records mutations from the sync push path.
- **Deferral boundary:** Read/time-travel UI is 3.5.1; revert is 3.5.2.
- **Validation target:** targeted; ledger write proof.
- **Files:** prisma/schema.prisma (+migration), lib/sync/*

### 3.5.1 - Time-Travel Read
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Read-only time-travel/history view over the 3.5.0 ledger.
- **Product impact:** user-visible history view (read-only).
- **Runtime integration target:** history reads the ledger.
- **Deferral boundary:** Revert/write-back is 3.5.2.
- **Validation target:** targeted + manual product proof (view past state).
- **Files:** components/history/*, lib/*

### 3.5.2 - Revert
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Revert-to-a-prior-state action built on the ledger + time-travel read.
- **Product impact:** user-visible revert.
- **Runtime integration target:** revert writes through the Replicache spine.
- **Deferral boundary:** Closes the 3.5 history sub-arc.
- **Validation target:** targeted + manual product proof (revert + sync).
- **Files:** lib/sync/*, components/history/*

### 4.0 - Expo / React Native Mobile
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Native mobile client on the SAME Replicache spine. Decompose into sub-phases at 4.0 scope time.
- **Product impact:** mobile app.
- **Runtime integration target:** Expo/React Native client shares the web sync spine.
- **Deferral boundary:** MCP is 4.1; sub-phase breakdown deferred to 4.0 scope time.
- **Validation target:** defined at 4.0 decomposition.
- **Files:** TBD - new Expo/React Native surface

### 4.1 - MCP Integration
- **Status:** Open
- **Type:** product behavior
- **Implementation goal:** Expose Tidy via MCP. Decompose when reached.
- **Product impact:** programmatic/agent access.
- **Runtime integration target:** MCP server over Tidy data.
- **Deferral boundary:** Full decomposition deferred to 4.1 scope time.
- **Validation target:** defined at 4.1 decomposition.
- **Files:** TBD - decompose at 4.1

---

## Potential Next Directions (unversioned)

Assigned a version only when scoped.
- Investigate why open-phase.ps1/promote.ps1's committed codebase-graph.json (fallback generator) reads as stale against validate.ps1's freshness regeneration, so the Section 2 graph refresh is not needed on every phase (scripts/generate-codebase-graph.ps1, scripts/generate_codebase_graph.py, scripts/validate.ps1)
- Rate limiting and abuse controls
- Persistent sync idempotency ledger for duplicate-request auditability beyond semantic idempotency (distinct from the 3.5.0 mutation ledger, which serves history/time-travel)
- Observability
- Scale/performance profiling
- Order compaction
- Installable-PWA polish: manifest metadata + icon set (the app-shell service worker and app/manifest.ts already ship)
- Mobile/touch drag-drop + responsive QA (components/list/*)
- Accessibility + UI polish pass (folds into 3.2.x design-token + shell work when scoped)
- Migration/backfill playbook (prisma/schema.prisma, prisma/migrations/*)
- Retire the remaining docs/deprecated/* legacy archive (~25 files: the 00-16 reverse-engineering set plus app-reverse-engineering, codex-prompt-template, optimistic-updates, task-routing-guide, testing, and testing-validation docs) after per-file verification that each is superseded by a live owner; backlog.md and phase-1-dexie-foundation.md were already removed in 3.0.2. Resolve README.md in the same pass (sync or retire).

Superseded by pinned arc phases (pointers, not separate backlog):
- Finer-grained shared-list collaboration - sharing owner tags/custom views with recipients, and letting recipients reorder shared lists within their own organization - is owned by 3.4.2 (Collaboration & Sharing UX).
- Replicache pull resiliency under concurrent pulls (`buildReplicacheClientView` `list.listItems` crash) and `selectedView` convergence for `tests/e2e/views.spec.ts` "latest selected view wins after fast switching" - now owned by 3.2.8 (Concurrent-Pull Resilience & Fast-Switch View Convergence). Pre-existing; surfaced during 3.2.4, reconfirmed at `--workers=2` during 3.2.5.
- Rich-text/structured item notes and remote-cursor presence are owned by 3.3.0 (item panel/notes) and 3.4.0/3.4.3 (presence transport + live presence); plain-text Yjs notes already shipped in 2.0.6.

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

Live cross-cutting risks are owned by `docs/AI_HANDOFF.md` ("Known Risks"), kept current with the Replicache architecture. The 1.9.x optimistic-queue, Dexie-fallback, and pending-overlay risks formerly listed here were retired by the 2.0 Replicache render inversion; see `docs/AI_HANDOFF.md` "Removed Legacy Paths".

