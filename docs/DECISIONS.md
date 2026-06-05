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
