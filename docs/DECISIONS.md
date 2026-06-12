# Decisions

Captures important implementation decisions so future sessions preserve intent. Add dated entries when changes alter architecture or behavior. Include the reason  -  not only the outcome.

If a decision invalidates another doc, update both. Decisions that affect production risk should also update `docs/AI_HANDOFF.md` Known Risks section.

---

## 2026-05-28: Adopted HFK-style AI workflow

Migrated tidy's docs to an HFK-style workflow: STATE.json oracle, five-location versioning, ChromaDB doc query, CODEX_RULES.md, AI_HANDOFF.md, PHASE_LOG.md, FUTURE_PLANS.md, DECISIONS.md, validate/promote scripts.

**Reason**: Tidy and HFK are structurally similar apps (UI-heavy, optimistic updates, growing AI docs). As docs/ai/ grows beyond 20 files, session-start overhead compounds. ChromaDB query-first retrieval reduces this 60 - 70% and makes the workflow scale with the project.

**Impact**: Old docs/ai workflow-layer files (00-entrypoint, 01-state, 12-rules, 15-decisions, backlog, codex-template, phase-logs/) are deprecated but their content is preserved in the new docs.

---

## 2026-05-09: AI docs are mandatory maintenance surface

Every future implementation must update the relevant AI docs and backlog in the same PR.

**Reason**: Future Codex sessions should read compact repo-specific docs instead of scanning the whole repo.

---

## Existing: All Lists is the canonical full dashboard payload

`view.getViewListsWithItems({ viewId: allListsView.id })` is treated as the full list/item/tag payload. Selected/custom views are explicit payloads or projections from All Lists plus view metadata.

**Reason**: Custom view order and membership are view-specific and should not collapse into a single current-view source of truth.

---

## Existing: View membership is materialized in `ViewList`

Custom views store matching lists in `ViewList`, not only computed on every read.

**Reason**: Each view needs stable list ordering and efficient payload reads.

---

## Existing: Drag hover is local-only

List, item, and view drag hover updates local preview state. Drop commits cache once and schedules one server save.

**Reason**: Hover fires too frequently and should not rewrite large query caches.

---

## Existing: Reorders use batch SQL

`view.reorderViews`, `view.reorderViewLists`, and `listItem.reorderListItems` use raw SQL `UPDATE ... FROM (VALUES ...)`.

**Reason**: Many small individual Prisma updates caused timeout/performance issues.

---

## Existing: Reorder and selection saves replace pending work

Reorders and selected-view saves use `replacePending`.

**Reason**: Only the newest final visible state matters.

---

## Existing: Heavy view recompute should avoid long transactions

Several flows recompute custom views after short write transactions rather than inside them.

**Reason**: Prisma interactive transactions can timeout on large accounts.

---

## Existing: Client UUIDs support optimistic creation

Lists, items, tags, and views accept client-generated IDs.

**Reason**: UI can render optimistic objects immediately and reconcile them with server responses.

---

## 2026-06-05: Keep in-memory optimistic queues; defer durable pending writes to 1.8.x

The module-level optimistic queue state in `hooks/useOptimisticSync.ts` (`chains`,
`entries`, `latestStartedSequence`, `nextSequence`) is intentionally kept in memory for
the 1.7.x series. We are NOT introducing Dexie-backed or otherwise durable pending-write
persistence now. Durable pending-write persistence is deferred to the 1.8.x local-first
series (1.8.0 local DB role audit, 1.8.1 outbox replay integration plan, 1.8.2 offline
write path prototype).

**Reason**: 1.7.x is a contract- and test-hardening series for optimistic queue
behavior, not an offline rewrite. Durable pending writes would change the dashboard write
path and interact with the existing Dexie/outbox foundation (`lib/local-db/*`), which is
high-risk and belongs behind the planned 1.8.x audit/prototype gates. Starting it inside
1.7.3 would be an accidental half-offline implementation. The known failure mode (pending
writes lost on refresh or crash) is bounded, already documented as a risk, and acceptable
until the offline series addresses it deliberately.

**Impact**: The "in-memory queues can lose pending writes on refresh or crash" risk is
accepted as temporary by design, not a defect to patch in 1.7.x. The
`hooks/useOptimisticSync.ts` module-level queue state remains volatile-by-design until the
1.8.x series. No source or test behavior changes in 1.7.3.

**Update (2026-06-05, recorded in 1.8.7):** The 1.8.x series referenced above shipped as
scaffolding only - 1.8.0 local DB role audit, 1.8.5 outbox replay-endpoint integration test
plan, and 1.8.6 isolated offline write-path prototype (the original "1.8.1/1.8.2" numbers were
renumbered to 1.8.5/1.8.6). It did NOT introduce durable pending-write persistence or wire
Dexie/outbox into the runtime dashboard. Durable pending writes and the full offline write path
are rescheduled to the 1.9.5-1.9.10 integration series; see the decision below.

---

## 2026-06-05: Reschedule real Dexie/offline integration to a chokepoint-first 1.9.x series

Recorded during 1.8.7. The 1.8.x local-first series completed without wiring Dexie/outbox into
the live dashboard: no dashboard mutation creates an outbox operation, nothing reads Dexie at
runtime, no replay worker runs, and `lib/sync/offline-write-prototype.ts` ships behind
`OFFLINE_WRITE_PROTOTYPE_ENABLED = false`, imported only by its test. The deferral promise in the
2026-06-05 in-memory-queue decision was therefore left undischarged.

**Decision**: Do real integration chokepoint-first. Keep 1.9.0-1.9.4 (dashboard
component/responsibility audit + mutation cache helper extraction) but treat them as the enabling
refactor that creates a single dashboard-mutation chokepoint in `lib/dashboard-cache.ts`. Then run
a dedicated integration series 1.9.5-1.9.10: Dashboard Mutation to Outbox Wiring, Durable
Pending-Write Integration, Automatic Replay Worker (plus a real `/api/sync` route), Sync Status UI
Surface, Offline Conflict Resolution Rules, and a Local DB Source-of-Truth Decision.

**Reason**: Wiring outbox capture into today's scattered mutation sites (`ListAdder`,
`ListComponent`, `ListsContainer`, `ViewsSidebarPreview`, `ListTagPicker`) is the high-risk
write-path change the earlier decision warned against. Establishing one mutation chokepoint first
makes the capture wiring a single-seam change instead of a cross-component rewrite.

**Impact**: 1.9.x is reframed from pure maintainability to the on-ramp for offline. The "in-memory
queues lose pending writes on refresh/crash" risk remains accepted-temporary until 1.9.6.

---

## 2026-06-06: Offline replay conflict policy is timestamp last-write-wins, server-authoritative on ties (1.9.9)

Replayed offline outbox operations resolve conflicts with the server using a deterministic, per-operation
last-write-wins rule keyed on timestamps. `resolveOutboxOperationConflict` (`lib/sync/conflict-resolution.ts`)
compares the operation's `updatedAt` against the server entity snapshot's `updatedAt`:

- No server record for the entity -> client operation applies (no conflict).
- Client `updatedAt` strictly newer than server -> client wins; the operation replays.
- Server `updatedAt` newer than or equal to the client, or either timestamp missing/unparseable -> server wins;
  the operation is discarded without replay and reported as `resolved-server-wins`.

**Reason**: The rule must be deterministic so identical inputs always resolve the same way, and it must keep the
sync endpoint as the authority (consistent with the replay seam where the endpoint is the auth authority).
Last-write-wins matches the optimistic-UI expectation that a user's newest edit should win, while the
server-authoritative tie-break (equal or missing timestamps resolve to the server) prevents nondeterministic
flapping and stops a client silently clobbering equally-timestamped server state.

**Scope and deferral**: 1.9.9 implements and tests the pure policy and wires it into the replay path behind an
optional `getServerSnapshot` provider on `replayOutboxOperations`. No runtime caller supplies that provider yet,
so default behavior and the off-by-default `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` UX are unchanged. Reading
authoritative server state and applying operations to the database remains deferred to 1.9.10 (Local DB
Source-of-Truth Decision), which will supply a real snapshot provider.

**Impact**: The "No conflict policy exists for offline replay" known risk in `docs/AI_HANDOFF.md` is discharged as
a recorded, tested policy; runtime application of that policy still waits on 1.9.10.

---

## 2026-06-06: Dashboard source of truth is the server; Dexie is a write-side buffer, not a read source (1.9.10)

The dashboard read authority is the server: the tRPC All-Lists payload (view.getViewListsWithItems({ viewId: allListsView.id })), surfaced through the TanStack Query cache and lib/dashboard-cache.ts. Dexie / the local outbox (lib/local-db/*) is a durable WRITE-side buffer for offline-originated mutations only; it is never read as the source of truth for rendering lists, items, tags, or views at runtime. No read change is adopted in 1.9.10.

**Reason**: The entire 1.9.5-1.9.9 integration arc was built on the server as the read authority - All Lists is the canonical payload, custom views project from it, TanStack query keys/cache shapes and optimistic/rollback invariants all key off the server payload, and the 1.9.9 conflict policy is server-authoritative on ties. Making Dexie the read source would require wiring lib/local-db into lib/dashboard-cache.ts, which deliberately breaks the local-db-role-audit.test.ts guard and re-bases every projection and optimistic invariant on local state - a high-risk architectural inversion with no current product driver. Keeping the server authoritative preserves those invariants and keeps Dexie's role (durable offline write queue + replay) exactly as scaffolded.

**Scope and deferral**: This is a recorded decision with no source change. The optional getServerSnapshot provider added to replayOutboxOperations in 1.9.9 remains intentionally unsupplied at runtime: because the server stays the source of truth and the dashboard does not read Dexie, there is no runtime path that applies replayed operations to a local DB and re-reads it. Applying replayed operations server-side (a real /api/sync that mutates the database) and any future local-read mode remain out of scope and would be a new, explicitly-driven phase, not part of this on-ramp.

**Impact**: Discharges the 1.9.10 "Local DB Source-of-Truth Decision" item. The seriesComplete flag in STATE.json stays false by decision (to be flipped in a later explicit step). Dexie/local DB remains the non-source-of-truth local layer characterized by tests/unit/local-db-role-audit.test.ts; that guard stays green and unchanged.

---

## 2026-06-07: Product-first roadmap rebaseline - direction, Dexie local-runtime supersession, and workflow-drift finding (1.9.11)

**Direction**: Tidy's near-term identity is locked as a fast personal todo app with local-first UX, built as a portfolio-grade engineering showcase. Planning shifts to thin vertical product slices over long horizontal infrastructure chains, captured by the Product-First Planning Contract in docs/WORKFLOW.md and the per-phase declaration format in docs/FUTURE_PLANS.md.

**Dexie supersession**: This supersedes the planning stance of the 2026-06-06 "Dashboard source of truth is the server; Dexie is a write-side buffer" decision. Dexie moves forward as the local runtime source for dashboard CRUD, slice by slice (create list first), with TanStack/tRPC retained as the server hydration/sync bridge and PostgreSQL/Supabase as the remote durable source of truth. Full local-first database ownership is pursued later only if the slices prove it correct (1.9.21 decides). Redis stays deferred and is not a substitute for browser local-first UX. This is the explicitly-driven phase the 2026-06-06 decision named as the only way to revisit the server-as-read-authority stance; it is a planning-level direction change only. No runtime read flips in 1.9.11, and the tests/unit/local-db-role-audit.test.ts guard stays green and unchanged until the create-list read path actually flips in 1.9.17.

**Workflow-drift finding (high severity)**: The workflow had no gate preventing infrastructure, gated behavior, and decision-only work from reading as delivered product progress; the 1.9.5-1.9.10 offline arc shipped infrastructure plus a decision with no user-visible local-first behavior. The Product-First Planning Contract (per-phase Type / Product impact / Runtime integration target / Deferral boundary) is the corrective gate.

**Validation policy**: Targeted validation during alpha, full validation before stable, with a mandatory manual product proof for product phases - referenced from docs/WORKFLOW.md Validation Intensity and amended into docs/CODEX_RULES.md Required Tests, not duplicated.

**Impact**: The roadmap is rebaselined into the new format with the product-first arc inserted as 1.9.11-1.9.21 ahead of the existing 1.10.0-1.11.3 entries (monotonic order preserved; no renumber of existing entries). seriesComplete in STATE.json stays false by decision. The AI_HANDOFF Known Risks realignment for the Dexie direction is handled in 1.9.13, not here.

---

## 2026-06-07: Completed-version history single-owner is FUTURE_PLANS Completed; VERSIONING history table retired (1.9.14)

**Decision**: `docs/FUTURE_PLANS.md` `## Completed` is the single owner of completed-version history (version, title, and stable date for every released phase). The `## Version History` table in `docs/VERSIONING.md` is retired and replaced with a pointer. `docs/VERSIONING.md` now owns the version format, the five-location rules, the Doc Continuity Model, current state, and the pre-versioning baseline only.

**Reason**: The VERSIONING history table duplicated FUTURE_PLANS Completed on version+title+date for ~190 rows; its only unique columns were a `state` field (always "stable" for history) and a `notes` field that promotion never populated (it stayed at the open-phase "(in progress)" placeholder). FUTURE_PLANS Completed already records version+title+stable-date and is the roadmap-closeout owner per the Doc Continuity Model, so it is the natural single owner. Retiring the table also dissolves the stale "(in progress)" notes finding.

**Scripts**: `open-phase.ps1` no longer inserts an alpha history row or self-verifies it; `promote.ps1` no longer flips a history row to stable or self-verifies it. Both still update the VERSIONING current-version line and FUTURE_PLANS roadmap state as before. `validate.ps1` never gated the history table, so no validation change was required.

**Impact**: No information lost - version, title, and date remain in FUTURE_PLANS Completed, and the pre-versioning Phase 1-3 detail stays in VERSIONING. Pointer references in AI_HANDOFF, COMPACT_STRATEGY, CONTEXT_INDEX, and WORKFLOW were updated to stop claiming VERSIONING holds a history table.

## 2026-06-08: Reclassify 1.9.17 as honest infrastructure; re-sequence the 1.9.x arc views-first

1.9.17 shipped committed, green plumbing - the create-list Dexie write-through + read-back moved into `lib/dashboard-cache.ts`, the `local-db-role-audit` guard was flipped to permit the sanctioned `local-db/local-repositories` import, and the dev-gated bridge `lib/sync/local-first-create-list.ts` was retired. It was declared the "first user-visible local-first behavior." That claim is not earned.

**Finding**: The local-first dashboard render is gated on server-only VIEWS. Lists render only when `view.getAll` loads AND `selectedViewId` resolves AND `snapshot.view.id === selectedViewId` (the `isLatestSelectedView` exact-match guard in `lib/dashboard-cache.ts`, with `selectedViewId` derived from `selectedViewFromCache(view.getAll)`). The read path is fully client-side `useQuery` (`app/dashboard/page.tsx` -> `<Dashboard/>` -> `components/list/ListsContainer.tsx`) with NO SSR prefetch / HydrationBoundary, so reload refetches from the server and Dexie is never consulted on hydration. Offline, `selectedViewId` is undefined, the guard is false, `currentView` is undefined, and the list renders empty. The 1.9.17 read-back is therefore value-identical to the server payload and produces no user-visible change. Per-CRUD-slice local-first reads are blocked until a local-first views/dashboard boot exists.

**Decision**: (a) Reclassify 1.9.17 as infrastructure and promote it honestly - no local-first product banner. (b) Re-sequence the remaining 1.9.x arc views-first: a new 1.9.18 - Local-First Views/Dashboard Scaffold becomes the next phase and the real unlock; the existing slices renumber down (rename 1.9.18->1.9.19, item create/complete 1.9.19->1.9.20, delete/recovery 1.9.20->1.9.21, CRUD rebaseline decision 1.9.21->1.9.22; 1.10.x and later unchanged). (c) The genuine offline create-list hydration read (create a list, go offline, reload, still renders from Dexie) folds INTO the 1.9.18 views-foundation phase, because the views/selected-view render boot is its hard prerequisite, not a separable follow-up.

**Supersession**: This revises the 2026-06-06 "Dashboard source of truth is the server; Dexie is a write-side buffer" decision. The 1.9.18 views-foundation phase will make Dexie a runtime READ source on the offline/seed path (the views+selected-view boot resolves locally), with TanStack/tRPC retained as the online hydration/sync bridge. This is the explicitly-driven phase that earlier decision named as the only way to revisit the server-as-read-authority stance.

**Impact**: 1.9.17 promotes as honest infrastructure with no product over-claim. `docs/AI_HANDOFF.md` over-claims (create-list "renders from local state by default" / "enabled by default" / "no list/item/tag/view is read from or written to Dexie at runtime") are corrected to state there is no user-visible change. seriesComplete in STATE.json stays false by decision.

---

## 2026-06-09: Re-sequence the local-first arc service-worker-first; preserve the stopped Dexie-read attempt (1.9.18)

The original 1.9.18 "Local-First Views/Dashboard Scaffold" attempt was stopped (not merged) after two
blocking findings. Its Dexie work is preserved on branch wip/local-first-dexie-read (do NOT delete it;
it seeds 1.9.20).

**Finding 1 - offline reload needs an app-shell, not just a Dexie read.** A true "go offline -> reload
-> renders from Dexie" proof is impossible without an offline app-shell. Without a service worker, an
offline full reload dies with ERR_INTERNET_DISCONNECTED before any JS runs (production included), so no
read path executes at all. The Dexie read path alone cannot deliver an offline reload; the views/dashboard
scaffold was therefore not the real unlock - the service worker is the prerequisite.

**Finding 2 - the Dexie read path needs reconciliation.** The preserved attempt reached 23/26 e2e. The
remaining failures were duplicate React keys and undefined `list.listItems` under rapid-create + reload,
caused by stale/duplicate Dexie rows. This is a reconciliation/dedup problem and is split into its own
phase rather than folded into the read fallback.

**Decision.** Re-sequence the remaining 1.9.x arc service-worker-first:
- 1.9.18 - Roadmap Re-Plan Correction (this docs/workflow phase: record this decision, re-sequence
  FUTURE_PLANS, correct AI_HANDOFF).
- 1.9.19 - Offline App-Shell (Service Worker): precache + serve the app shell + dashboard route so an
  offline reload runs the client instead of the browser offline-error page. The real prerequisite/unlock.
  Design-heavy; plan first.
- 1.9.20 - Dexie Read Fallback (API-Unavailable): render from Dexie when tRPC is unreachable but the app
  is already loaded; server authoritative, fallback inert online. Proof by blocking tRPC (Playwright
  route.abort), NOT a full offline reload. Seeded by wip/local-first-dexie-read (readers/mappers in
  lib/local-first-dashboard.ts, hooks/useLocalFirstDashboardBoot.ts, render-gate fallback, offline
  ListAdder, loop fix).
- 1.9.21 - Dexie<->Server Reconciliation & Lifecycle: dedup, stale-row cleanup, correct every-load
  seeding; fixes the Finding-2 dup-keys / undefined-listItems bug.
- The per-slice local-first writes shift down: rename 1.9.19->1.9.22, item create/complete 1.9.20->1.9.23,
  delete/recovery 1.9.21->1.9.24, CRUD rebaseline decision 1.9.22->1.9.25. 1.10.x and later are unchanged.

**Supersession.** This revises the 2026-06-08 "Reclassify 1.9.17 ... re-sequence the 1.9.x arc views-first"
decision, which named a new 1.9.18 views/dashboard scaffold as the offline unlock and folded the genuine
offline create-list hydration read into it. Finding 1 invalidates that: the views/selected-view boot cannot
produce an offline reload without the service-worker app-shell. The genuine offline-reload proof now requires
the app-shell (1.9.19) first, then the Dexie read fallback (1.9.20) and reconciliation (1.9.21). The
2026-06-06 "server is the dashboard read authority; Dexie is a write-side buffer" decision remains superseded
in direction (Dexie advances to a runtime read source on the offline/fallback path), now via the SW-first path.

**Impact.** seriesComplete in STATE.json stays false by decision. docs/AI_HANDOFF.md claims that named the old
1.9.18 views/dashboard scaffold as the offline unlock are corrected in this phase to state the offline reload
requires the service-worker app-shell first. No source or test behavior changes in 1.9.18.

---

## 2026-06-10: Prioritize immediate dashboard correctness and Dexie-first bounded batch sync

The 1.9.20 review found that the current local fallback and outbox prototype do not satisfy the intended
local-first product behavior:

- The fallback can render during ordinary query loading, before API unavailability is established.
- The local snapshot contains views and lists only; mapped lists always contain an empty `listItems` array.
- Most dashboard actions still persist through direct component-level tRPC mutations.
- Replay sends one HTTP request per operation.
- `/api/sync` validates and acknowledges an operation but does not apply it to PostgreSQL.
- Failed replay operations are moved to `failed` while the replay query reads only `pending`, so failures can
  become stranded.

**Decision 1 - correct the complete local graph before expanding writes.** 1.9.21 owns deterministic
server-to-Dexie reconciliation for views, lists, list items, tags, relationship rows, and ordering. It must
preserve pending local work, deduplicate client/server identities, remove stale acknowledged rows, and
distinguish ordinary API loading from confirmed API unavailability. A structurally incomplete local snapshot
must never be rendered as if it were authoritative.

**Decision 2 - Dexie becomes the primary local dashboard source.** For migrated dashboard behavior, a user
action is committed by one atomic local transaction that updates the affected Dexie entity/relationship rows
and appends or coalesces its outbox intent. TanStack Query remains the render/projection cache and may mirror
the committed local graph, but it is not the durable local authority. PostgreSQL/Supabase remains the remote
durable source.

**Decision 3 - remote dashboard persistence uses bounded batch flushes.** The production sync transport accepts
`operations[]` and sends one HTTP request per flush, bounded by an explicit operation-count and payload-byte
limit. The server re-derives the authenticated user, validates ownership and operation dependencies, applies
accepted operations to PostgreSQL with idempotency protection, and returns a result for every operation.
An operation is marked synced locally only after the server reports it durably applied or already applied.
An acknowledge-only endpoint is not a valid sync implementation.

**Decision 4 - direct per-action dashboard tRPC persistence is transitional only.** Each migrated slice must
remove its component-level mutation as the remote persistence path. By 1.9.26, list, item, reorder/move, tag,
view, selection, and relationship writes must all flow through Dexie/outbox and the batch endpoint. Existing
tRPC query procedures may remain the online hydration/read bridge.

**Decision 5 - movement remains local during interaction.** Drag hover stays preview-only. A committed drop
writes one local reorder/move intent, and repeated drops coalesce to the newest required state before a later
batch flush. Pending local placement overlays server hydration so switching views or receiving a stale server
payload cannot temporarily move an item back.

**Decision 6 - batch lifecycle is bounded, durable, and retryable.** Flushes may run after a bounded quiet
window, at a batch-size threshold, on reconnect, and at safe lifecycle opportunities. Only one flush may run
per user at a time. Transient failures return operations to a retryable state with backoff; reload recovers
stranded `syncing` work. Permanent validation/ownership failures remain visible and are never silently
reported as synced.

**Supersession.** This replaces the remaining per-slice roadmap language that said "server sync via
replay/TanStack" without requiring server application or a multi-operation request. It further specifies the
2026-06-07 Dexie local-runtime direction: the target is not slice-scoped direct tRPC writes plus a local copy;
the target is Dexie-first dashboard state plus bounded batch synchronization.

**Impact.** The two priority outcomes now own 1.9.21-1.9.26:

1. Immediate, correct list/item rendering from a complete reconciled local graph.
2. Dexie-first dashboard writes synchronized to PostgreSQL through bounded multi-operation requests instead
   of one request per action.

The 1.9.x series cannot be declared complete until both outcomes have end-to-end request-count and persistence
proof.

---

## 2026-06-10: Implement bounded batch apply with semantic idempotency

**Decision.** Phase 1.9.22 implements the full authenticated server apply matrix behind one bounded
`operations[]` request. The endpoint validates the envelope, user scope, operation matrix, duplicate
idempotency keys, payload limits, and parent-before-child dependencies. Accepted operations run in submitted
order inside one PostgreSQL transaction and return `applied`, `already-applied`, or an explicit permanent
`rejected` result. An unexpected transaction failure leaves the accepted batch unapplied and returns
retryable `failed` results for those operations.

**Idempotency.** No persistent idempotency-key ledger or Prisma model is added in this phase. Duplicate safety
comes from operation semantics: client UUID creates detect existing rows, updates and movement write desired
state, absent deletes are already applied, and relationship writes use upsert/delete-many behavior. A
persistent ledger remains a follow-up if stronger duplicate-request auditability or retention is required.

**Transaction boundary.** The accepted write set is atomic. Custom-view recompute remains outside the short
write transaction, matching the existing router timeout boundary. If post-commit recompute fails, the
underlying writes remain durable and their operation results remain applied; the failure is logged and the
projection can be repaired by a later recompute.

**Runtime boundary.** `flushOfflineWrites` now coalesces pending work and sends one count/byte-bounded request
per flush, then consumes the per-operation results. The existing public prototype gate remains off by default.
Dashboard component migration, flush scheduling/backoff, concurrent-flush control, and stranded-operation
recovery remain assigned to phases 1.9.23-1.9.26.

---

## 2026-06-11: Preserve movement dependency order and stable view-reorder coalescing (1.9.24)

Committed cross-list movement is represented by three local operations: the item `move`, the destination
list-item `reorder`, then the source list-item `reorder`. The move must remain first because server batch
application is FIFO and destination reorder ownership/membership validation requires the item to belong to
the destination already. Movement writes therefore use monotonically increasing local timestamps so the
existing created-at replay ordering cannot reorder same-millisecond operations.

Custom-view reorder uses the stable per-user `entityClientId = "view-order"` key. The server ignores that
identifier for view reorder, while the stable key lets repeated sidebar drops coalesce to the newest complete
custom-view order instead of accumulating one operation per drop.

Pending, syncing, and failed movement operations remain eligible for hydration overlay until acknowledged.
This prevents stale server payloads from repainting old list/item placement during a view switch or reload.

---

## 2026-06-11: Fold tag relationships into view operations and coalesce membership latest-wins (1.9.25)

Custom-view create and update operations carry their complete `tagIds` relationship state inside the
view operation payload. They do not emit separate `viewTag` attach/detach operations. This matches the
existing server-apply contract, which replaces the view's tag relationships while applying the view
create/update.

View rename and filter changes from one dialog save emit one combined `view` / `update` operation.
Splitting those edits into two operations would collide under latest-only update coalescing and could
discard either the rename or the filter change.

Relationship `attach` and `detach` operations are latest-wins for the same
`[userId+entityType+entityClientId]`. Attach then detach, detach then attach, and repeated attaches collapse
to the final required membership state. Existing delete supersession and unsynced create-plus-delete
annihilation rules remain unchanged.

Selected-view persistence uses `entityType = "metadata"` with the stable per-user
`entityClientId = "selected-view"`. Repeated fast selections therefore coalesce to the newest selected view
without creating one metadata entity key per view.

**Impact:** When the offline-write gate is enabled, tag CRUD, batched list-tag changes, custom-view
create/update/delete, and selected-view save commit atomically to Dexie plus the outbox and skip direct
component tRPC persistence. Optimistic cache projection remains immediate. Custom-view membership
reconciliation from tag/view edits is deferred to batch sync plus reload.
