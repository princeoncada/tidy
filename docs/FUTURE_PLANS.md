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


- 3.4.5 - Board Progress & Rollups (active) - see Planned
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
- Measure before fix (3.1.1 scopes from 3.1.0); data before visualization (3.4.5 reads real synced data first).
- Flag-gate risky product surfaces; every flag declares default, dev path, activation, and removal.
- Done = a named proof (test or manual product proof), never "looks done".

### 3.4.5 - Board Progress & Rollups
- **Status:** In progress
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
- One-time deterministic `ListItem.boardOrderKey` backfill to remove the multiplayer board legacy-null rollout window.
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

---

## Known Cross-Cutting Risks

Live cross-cutting risks are owned by `docs/AI_HANDOFF.md` ("Known Risks"), kept current with the Replicache architecture. The 1.9.x optimistic-queue, Dexie-fallback, and pending-overlay risks formerly listed here were retired by the 2.0 Replicache render inversion; see `docs/AI_HANDOFF.md` "Removed Legacy Paths".

