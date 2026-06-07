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
