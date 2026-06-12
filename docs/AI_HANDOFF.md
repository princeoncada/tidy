<!-- Current Version: 1.9.27-alpha -->
# AI Handoff

## Current Version / Phase

**Current Version**: 1.9.27-alpha - read `STATE.json` for the machine-readable oracle.
**Current Phase**: 1.9.27 - Roadmap Re-Plan Correction (Overlay-First Re-Sequence)
**Next**: 1.9.28 - Dexie-First Reconcile Overlay

Use these source-of-truth pointers instead of treating this file as a full history dump:
- `STATE.json` - version, state, phase, phase title, next phase.
- `docs/FUTURE_PLANS.md` - roadmap and next planned backlog item.
- `docs/CONTEXT_INDEX.md` - routing/scoping map for the smallest correct read set.
- `docs/VERSIONING.md` - version rules and current state; completed-version history lives in `docs/FUTURE_PLANS.md` Completed.
- `docs/PHASE_LOG.md` - historical traceability only, not active implementation guidance.

---

## Latest Completed Change

The latest completed change is the stable version recorded in `STATE.json`; read `docs/FUTURE_PLANS.md` Completed (top) for the full trail. This is a pointer by design so this section cannot drift - do not restate a frozen "latest" here.

Active arc: the 1.9.x product-first cleanup series. 1.9.11 added the Product-First Planning Contract and rebaselined the roadmap; 1.9.12 realigned the agent role model (Claude Code architects/scopes/plans/validates/writes prompts; Codex is the boosted implementer; ChatGPT reviews). The Codex validation boundary and five-location versioning rules are unchanged.

Approved priority correction (2026-06-10): finish two product outcomes before production-readiness or polish work. First, make list/item rendering immediately correct from a complete reconciled Dexie graph, without empty/duplicated/misplaced transient cards during normal API loading. Second, make Dexie the primary local dashboard source and synchronize accumulated operations to PostgreSQL through one bounded multi-operation request per flush, rather than one direct tRPC mutation per action. `docs/DECISIONS.md` owns the architecture contract and `docs/FUTURE_PLANS.md` owns the 1.9.21-1.9.27 sequence.

---

## Current Product Snapshot

Tidy is an authenticated personal todo workspace with optimistic-first updates.

**User actions**:
- Create lists and items.
- Complete and uncomplete items.
- Rename and delete lists and items.
- Create tags and attach/detach them from lists.
- Create custom tag-based views using ALL/ANY match modes.
- Switch views.
- Drag-and-drop reorder lists, items, and custom views.

**Routes**:
- `/` - landing card.
- `/register`, `/login`, `/forgot-password`, `/reset-password` - Supabase auth.
- `/auth/confirm`, `/api/auth/confirm` - Supabase callbacks.
- `/dashboard` - authenticated app guarded by `proxy.ts`.

**Key files**:
- `app/manifest.ts`, `public/sw.js` - native manifest and hand-written offline app-shell worker.
- `components/AppShellServiceWorker.tsx`, `hooks/use-app-shell-service-worker.ts`, `lib/sw/*` - service-worker mount, registration gate, and testable strategy contract.
- `app/dashboard/page.tsx` -> `components/Dashboard.tsx` -> `components/list/ListsContainer.tsx`.
- `components/views/ViewsSidebarPreview.tsx` - custom view UI and view selection/reorder behavior.
- `components/list/ListAdder.tsx`, `ListComponent.tsx`, `ListItemComponent.tsx`, `ListTagPicker.tsx` - dashboard list/item/tag workflows.
- `hooks/useOptimisticSync.ts` - module-level write queue.
- `lib/dashboard-cache.ts` - centralized TanStack Query cache helpers.
- `lib/sync/sync-batch-contract.ts`, `lib/sync/server-apply.ts` - bounded sync validation and authenticated PostgreSQL apply matrix.
- `trpc/routers/_app.ts`, `trpc/init.ts`, `trpc/routers/*` - tRPC API and auth context.
- `prisma/schema.prisma` - database schema.

---

## Architecture Invariants

**Data model:**
- Models: `List`, `ListItem`, `Tag`, `View`, `ViewList`, `ViewTag`, `ListTag`.
- `ViewList` owns list order per view; `ListItem.order` owns item order inside a list; `View.order` owns custom view order.
- Unique constraints: `View.name` per user, `Tag.name` per user, and `ViewList` primary key `[viewId, listId]`.
- Cascades remove dependent list items, list-tags, view-list memberships, view-tags, and list-tags as defined by Prisma relations.
- Sparse/negative order values are used for top insertion. No order compaction is implemented yet.

**Cache and state:**
- `view.getViewListsWithItems({ viewId: allListsView.id })` is the canonical full dashboard payload.
- Selected view payloads are explicit server/query payloads, not filtered copies of All Lists.
- Dashboard cache key aliases are stable: `views`, `allLists`, `currentView`, and `selectedView`.
- `ALL_LISTS` projection returns all lists.
- `CUSTOM` projection uses `listMatchesView` with `ALL`/`ANY`; custom views with zero tags match no lists.
- `UNTAGGED` projection returns lists with no tags, although it is not exposed as a full UI/server flow.
- Projected views apply per-view `ViewList.order` with list order fallback and deterministic tie-breaking.
- Latest-selected-view guards prevent stale view fetches or rollbacks from repainting `currentView`.
- Created-list reconciliation preserves optimistic child items, tags, and order when the saved list replaces an optimistic list.
- The single dashboard-mutation chokepoint is the trio-write seam in `lib/dashboard-cache.ts`: the private `setDashboardQueryDataOnce` used by `updateListInDashboardCaches`, `removeListFromDashboardCaches`, and the other snapshot helpers to fan one logical mutation across `allLists`, `currentView`, and `selectedView`; the single-fan-out contract is characterized in `tests/unit/dashboard-cache.test.ts`. 1.9.5 attached the first outbox consumer at the COMMIT (`onSuccess`) site of the create-list mutation in `ListAdder` via `captureDashboardMutationOutbox`, gated by `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` (`isOfflineWriteCaptureEnabled`). The gate defaults OFF, so default behavior is unchanged; capture lives in `lib/sync/offline-write-prototype.ts` (still never imported by `lib/dashboard-cache.ts` or `trpc/client.tsx`), is fire-and-forget, and swallows its own errors. List-item create capture is deferred because `ListItem` has no `userId`; replay (1.9.7) is not wired yet.
- Routed dashboard writes already go through `lib/dashboard-cache.ts` for list rename, list delete removal, list/item rename and completion, most item create paths, tag add/remove/delete affected-view reconciliation, view selection, and `ListTagPicker` tag metadata/color reconciliation and rollbacks (via `applyTagMetadataToDashboardCaches`, `captureTagMutationSnapshots`, and `rollbackTagMutationCaches`). Scattered raw `queryClient.setQueryData` writes still live in components for `ListAdder` create-list optimistic insert/reconcile/rollback, `ListComponent` create-item rollback and list-delete rollback, `ListItemComponent` delete-item rollback, `ListsContainer` list/item reorder, and `ViewsSidebarPreview` view create/rename/updateFilter/delete/reorder/select follow-up writes. The 1.9.2-1.9.4 list/view/tag mutation extraction arc is complete and the trio-write seam is ready for 1.9.5 outbox wiring.
- 1.9.25 extends the gated Dexie-first transaction path to tag create/update/delete, batched list-tag toggles, custom-view create/update/delete, and selected-view save. These paths keep the existing optimistic TanStack projection, then write the local entity/relationship rows plus coalesced outbox intent without issuing the component tRPC mutation when `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` and `userId` are present; the default gate-off paths remain unchanged.

**Optimistic updates:**
- Dashboard writes cache first and queues server saves second.
- Drag hover is local-only; cache/server writes happen on committed events such as drop, create, delete, rename, tag toggle, and completion toggle.
- Optimistic-only IDs must not be sent to server reorder endpoints.
- Reorder payload builders exclude optimistic-only list/item/view rows and compact saved-row order before persistence.
- Newest-state-wins scopes use `replacePending`: `views` for view reorder, `view-selection` for selected-view save, `list-order` for list reorder, and `item-order` for item reorder.
- Must-persist queued scopes use `enqueue`: `list-edits` for list delete, and `item-edits` for item delete plus delayed item create after optimistic list create. Other must-persist list/item/tag/view mutations use direct TanStack mutations or local tag batching, not `replacePending`.
- Failed non-CancelledError queue tasks no longer cancel their whole optimistic scope as of 1.7.1. A failed task runs its rollback only when it has not been explicitly canceled or superseded by later started same-scope work, then the same-scope chain continues.
- Active optimistic scopes include `views`, `list-tags`, `list-order`, `item-order`, `view-selection`, `list-edits`, and `item-edits`.
- Optimistic markers are `isOptimistic: true` on list/item shapes and `userId: "optimistic"` on view shapes.
- 1.9.6 added gated durable backing for pending optimistic writes: `useOptimisticSync.enqueue` accepts an optional `durable` ({ intent, db? }) that records a durable outbox operation via `captureDashboardMutationOutbox` (gated by `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED`, fire-and-forget, never awaited before the optimistic task), then marks it synced on success or failed on rollback. `reconcilePendingWritesOnLoad` (in `lib/sync/offline-write-prototype.ts`) reads pending durable ops for reload reconciliation. `hooks/useOptimisticSync.ts` therefore now imports `offline-write-prototype` under the gate and has LEFT the isolation-guard list; `lib/dashboard-cache.ts` and `trpc/client.tsx` remain guarded. No new capture call-sites and no replay were added (replay is 1.9.7); default behavior is unchanged when the gate is off.
- 1.9.7 added the automatic replay worker: a protected POST `app/api/sync/route.ts` that re-derives the Supabase user server-side and runs `validateSyncEndpointRequest` (401 unauthenticated, 422 on validation errors, 200 on accept); it validates and acknowledges only and does NOT apply operations to the database (server-side application is deferred to 1.9.9 conflict resolution and 1.9.10 source-of-truth). The replay trigger `hooks/use-offline-replay-trigger.ts`, mounted via `components/OfflineReplayTrigger.tsx` in `trpc/client.tsx`, runs `reconcilePendingWritesOnLoad` then `flushOfflineWrites` on load and on the `online` event, gated by `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED`; failures are swallowed and never block the queue. `trpc/client.tsx` imports only the component, so the local-db-role-audit and offline-write-prototype isolation guards stay green. No new durable capture call-sites were added.
- 1.9.8 adds a gated, read-only Sync Status surface: `components/SyncStatusBadge.tsx` (mounted in the dashboard header) reads the local outbox via the gated `readSyncStatusSurfaceForUser` bridge and the pure `createSyncStatusSurface` helper; it is inert when `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` is off, is not wired through TanStack Query, and is deliberately kept out of `trpc/client.tsx` and `lib/dashboard-cache.ts` so the isolation guards stay green.
- 1.9.9 records and implements the offline replay conflict policy: `resolveOutboxOperationConflict` (`lib/sync/conflict-resolution.ts`) is a pure, deterministic last-write-wins resolver (server-authoritative on equal/missing timestamps) consulted by `replayOutboxOperations` only when an optional `getServerSnapshot` provider is supplied. No runtime caller supplies it, so default behavior and the off-by-default prototype gate are unchanged and the badge/cache isolation guards stay green; runtime DB application of the policy is resolved by the 1.9.10 source-of-truth decision below.
- 1.9.22 supersedes the acknowledge-only transport: `/api/sync` now accepts a bounded `operations[]` envelope, re-derives the Supabase user, validates each operation and dependency order, applies accepted operations inside one PostgreSQL transaction, and returns an ordered result for every submitted operation. `flushOfflineWrites` coalesces and sends one bounded HTTP request per flush, then marks local rows synced only for `applied`/`already-applied`; permanent rejections remain failed and visible, while transient batch failures increment retry count. The path remains behind `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED`, which defaults off.
- Server idempotency in 1.9.22 is semantic rather than ledger-backed: client UUID creates are find-or-create safe, updates and movement set desired state, deletes use absent-as-already-applied, and relationship writes are idempotent. All accepted writes share one transaction. Custom-view recompute stays after commit to preserve the established short-transaction rule; a recompute failure is logged after the underlying writes are already durable and does not relabel those operations failed.
- 1.9.10 records the Local DB Source-of-Truth Decision: the server (the tRPC All-Lists payload via `lib/dashboard-cache.ts` + TanStack Query) remains the dashboard read authority; Dexie/outbox stays a write-side durability buffer and is never read at runtime. No read change is adopted (docs-only phase), so the `local-db-role-audit.test.ts` guard, the All-Lists projection, TanStack query keys/cache shapes, and optimistic/rollback invariants are all preserved unchanged. The optional `getServerSnapshot` provider on `replayOutboxOperations` stays intentionally unsupplied and no runtime server-side application of the conflict policy is adopted; server-side application would be a new, explicitly-driven phase. `seriesComplete` stays false by decision. See `docs/DECISIONS.md`.
- 1.9.16 added a dev-gated local-first read for the create-list slice behind `NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED` (default OFF). 1.9.17 stabilizes and enables it by default: the create-list Dexie write-through + read-back now lives inside `lib/dashboard-cache.ts` (`reconcileCreatedListInDashboardCaches` is async and calls the private `readBackCreatedListFromLocalDb`, which uses `createLocalEntityBase` + `getLocalDbOrThrow` from `lib/local-db/local-repositories`). The flag and the standalone bridge `lib/sync/local-first-create-list.ts` are retired; `ListAdder.onSuccess` now simply awaits `reconcileCreatedListInDashboardCaches(queryClient, dashboardKeys, createdList, variables.id)`. The read-back is fire-and-forget safe: any failure (including no-browser `getLocalDbOrThrow`) is caught and falls back to the server payload, so SSR/node and DB-unavailable paths reconcile from the server exactly as before. Because `dashboard-cache.ts` now performs one sanctioned create-list Dexie read, the `local-db-role-audit` guard was updated (not removed) to permit the `local-db/local-repositories` import while still banning outbox/replay/sync-worker/metadata/direct `tidy-db` coupling; `trpc/client.tsx` remains untouched. NO user-visible change: the dashboard still reads from the server, and the Dexie read-back is value-identical to the server payload, so create-list does not yet render from local state. Genuine local-first (offline) read requires the offline app-shell service worker (1.9.19) so an offline reload runs at all, then the Dexie read fallback (1.9.20) and reconciliation (1.9.21); the old 1.9.18 views/dashboard scaffold alone cannot deliver an offline reload. Other slices (rename/item/delete) stay server-read until 1.9.23-1.9.25.
- 1.4.27 fixed inline rename display reconciliation by syncing `ListInlineEdit` display/edit state from authoritative props only while not editing; optimistic instant display on save remains intact.
- 1.4.27 kept delete product behavior unchanged and hardened delete/reload E2E coverage by waiting for successful delete mutations instead of broadening the console gate.

**Views and tags:**
- Custom view membership is materialized in `ViewList`; it is not computed at read time.
- Frontend projection helpers and backend refresh behavior must agree before UI/UX polish.
- Tag operations batch through `pendingTagOperationsRef` in `ListTagPicker`; `tag.applyListTagChanges` is the preferred batch write path.
- Tag mutations keep writes in short transactions, then recompute affected custom views and return refreshed affected-view projection payloads.
- View selection uses `replacePending`; only the newest in-flight fetch or matching selected-view payload may write current view cache.

**Drag and drop:**
- Drag ids: `list-${id}` for list cards, `list-item-${id}` for item rows, and `list-drop-${id}` for list drop zones.
- List reorder writes `ViewList.order`, not `List.order`.
- Item cross-list move writes both `ListItem.listId` and `ListItem.order`.
- 1.9.24 routes committed list, item, and custom-view movement through atomic Dexie entity/relationship plus coalesced operation writes when `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` and `userId` are present. The default gate-off path retains the existing per-drop tRPC mutations.
- Cross-list movement appends the item move before destination and source list reorders; movement timestamps are monotonic so batch replay preserves that dependency order. Custom-view reorder uses the stable per-user `entityClientId = "view-order"` key.
- Pending, syncing, or failed movement operations overlay incoming current/selected-view snapshots before render, preserving local list order and item placement while server hydration is stale. `ListsContainer` reaches this state only through `local-write`, `local-movement`, and the existing repository surface; direct replay/database-construction imports remain role-audited out.
- `ALL_LISTS` view is pinned and not sortable; only custom views are reorderable.
- Authenticated drag/drop E2E waits for reorder mutation success before reload assertions.
- Custom view reorder product behavior exists, but its authenticated E2E stabilization is deferred to `1.4.26 - Custom View Reorder E2E Stabilization`.

**Authentication and API:**
- All dashboard data is user-scoped by Supabase user id.
- Use `protectedProcedure` for user data.
- Server-side ownership checks are mandatory even if UI only exposes owned IDs.
- `absoluteUrl` resolves from `window.location.origin`, `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`, then localhost fallback.

**Performance and local-first boundary:**
- Reorder endpoints use batch raw SQL (`UPDATE ... FROM (VALUES ...)`) because individual Prisma updates timed out.
- Heavy custom view recompute should stay outside short Prisma interactive transactions unless proven safe.
- The offline app-shell landed in 1.9.19: `public/sw.js` is registered through `AppShellServiceWorker` when `NODE_ENV=production` or `NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED=true`; navigations are network-first with a cached shell fallback, while only `/_next/static/` assets are cache-first. `app/manifest.ts` provides the native Next manifest.
- The Dexie runtime read fallback now assembles a complete dashboard graph: list items, tags, list-tags, view-tags, view-list membership, and ordering are always defined before rendering. Custom views use the same tag projection and deterministic order semantics as the server-backed dashboard.
- Successful server views plus the canonical All Lists payload are reconciled into Dexie in one local transaction. Reconciliation preserves local identity for acknowledged optimistic rows, keeps unmatched non-synced work, and removes stale synced rows.
- The local fallback is inert during ordinary loading and whenever server views data exists. It renders only after the views query has settled into an error state with no server data, so normal online loading remains server-backed.
- A gated replay trigger is mounted through `OfflineReplayTrigger`, but `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` defaults off. When enabled, one flush now sends one bounded coalesced batch to `/api/sync`; the endpoint applies accepted operations to PostgreSQL and returns per-operation outcomes.
- All dashboard mutation categories now have a gated Dexie/outbox path: list/item CRUD (1.9.23), movement/order (1.9.24), and tag/view/relationship/selection writes (1.9.25). The prototype gate still defaults off, so legacy component tRPC persistence remains the default runtime path until 1.9.27 removes it after the 1.9.26 worker lifecycle phase.
- Approved target for 1.9.22-1.9.27: one atomic Dexie entity/outbox transaction per committed action, TanStack as the render projection, one bounded `operations[]` request per flush, real authenticated/idempotent server application, retryable failure handling, and no remaining direct dashboard tRPC persistence.
- Drag hover remains local-only. A committed drop will become one durable local move/reorder intent, coalesced before batch sync; pending placement must overlay server hydration so stale payloads cannot repaint old placement.

---

## Known Risks

**Security (P0 before API expansion):**
- `listItem.getListItems`, `renameListItem`, `deleteListItem`, and `setCompletionListItem` are owner-scoped through `parentList.userId` as of 1.6.1 and covered by `tests/unit/router-ownership-baseline.test.ts`.
- `listItem.reorderListItems` now verifies item ownership and target list ownership before the batched raw SQL update as of 1.6.2, closing the FK-23503 target-list gap.
- All listItem ownership gaps captured by the 1.6.0 baseline are now closed in `tests/unit/router-ownership-baseline.test.ts`.
- The 1.6.x P0 ownership series is complete: 1.6.3 adds `tests/unit/router-ownership-sweep.test.ts` to prove list/tag/view transactional procedures reject foreign input, while owned-flow happy paths remain covered by authenticated E2E to avoid brittle deep-transaction unit mocks.

**Optimistic and race behavior:**
- Optimistic queue mechanics (enqueue FIFO ordering, independent-scope isolation, replacePending cancellation, failure rollback without whole-scope cancel, CancelledError handling) are baselined in `tests/unit/optimistic-sync-baseline.test.ts` as of 1.7.2; replacePending-vs-enqueue scope isolation is test-locked, but broader cross-component optimistic race behavior is still not fully proven.
- Rollback containment now prevents superseded failed tasks from repainting over newer started same-scope work. Residual risk: blind snapshot rollbacks can still leave or repaint stale state when newer same-scope optimistic work is queued but has not started and does not overwrite the failed field.
- In-memory optimistic queues can lose pending writes on refresh or crash. Accepted as temporary by design per the 2026-06-05 decision in `docs/DECISIONS.md` (keep in-memory queues); durable pending-write integration was NOT delivered by the 1.8.x scaffolding series and is rescheduled to the 1.9.5-1.9.10 integration series.
- Reorders involving optimistic-only rows must keep filtering optimistic-only IDs before server writes.
- Tag deletes or rapid tag toggles can affect custom view membership mid-operation.
- Gated tag/view writes preserve immediate cache projection, but custom-view membership reconciliation after tag or view-filter edits is deferred to batch sync plus reload instead of applying the legacy mutation response payload.
- Fast view switching depends on latest-selected-view guards to avoid stale repaints.
- Immediate item creation after list creation is covered, but nearby optimistic list/tag/item races remain risk areas.
- Inline list/item rename uses component-local edit state; the row remounts when an optimistic row is swapped for its canonical server record, which can drop an in-progress manual rename. Authenticated E2E re-resolves the inline input after entering edit mode and awaits the rename mutation before reload; a product fix (stable row identity or lifted edit state) is a candidate follow-up.
- Optimistic custom-view create can briefly fetch `view.getViewListsWithItems` before `view.create` commits, causing a transient self-healing 404 deferred to a future product phase.

**Local-first and sync:**
- 1.9.23 adds a gated Dexie-first path for list/item create, rename, complete/uncomplete, and delete. When `NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED` is on, these actions commit through `lib/local-db/local-write.ts` in one atomic Dexie entity + coalesced outbox transaction and fire no component tRPC mutation; the batch endpoint is the only remote path. The gate defaults off, so default runtime is unchanged and legacy tRPC handlers remain until 1.9.27. `ListsContainer` only threads `userId` and adds no outbox, direct `tidy-db`, replay, or metadata import, preserving the role-audit guard.
- 1.9.24 extends that gated path to list order, same-list item order, cross-list item movement, and custom-view order. Repeated drops coalesce by view/list/item movement key, and stale view payloads are overlaid from unacknowledged local movement until the server acknowledges the batch.
- 1.9.25 extends the gated path to tag CRUD, batched list-tag attach/detach, custom-view CRUD/filter relationships, and selected-view metadata. View create/update carries `tagIds` inside the view operation to match server apply, rename plus filter edits emit one combined view update, membership attach/detach coalesces latest-wins per relationship, and selected-view uses the stable `entityClientId = "selected-view"`.
- The offline app-shell plus reconciled Dexie fallback can render a structurally complete local dashboard graph after confirmed API unavailability. Remaining read risk is lifecycle freshness between the last successful server seed and later offline use; unmatched pending/local/failed rows are intentionally preserved rather than overwritten or deleted.
- The offline replay conflict policy remains deterministic timestamp last-write-wins, server-authoritative on equal/missing timestamps (`lib/sync/conflict-resolution.ts`). Its optional `getServerSnapshot` provider still has no runtime caller; real server application and per-operation results are owned by the bounded batch endpoint phase.
- The 2026-06-10 decision supersedes the remaining server-authoritative/per-slice planning stance for future work. The delivery target is a complete Dexie dashboard graph plus bounded batch synchronization; existing direct tRPC persistence is transitional, not the accepted final architecture.
- Gated runtime dashboard mutations now commit through the local-write helpers across list/item CRUD, movement/order, tag/view CRUD, relationships, and selected-view metadata. The legacy tRPC branches remain present and are still the default while the prototype gate is off.
- The acknowledge-only, one-request-per-operation, and dashboard mutation coverage risks are discharged through 1.9.22-1.9.25. 1.9.26 delivers gated sync lifecycle scheduling (quiet-window/threshold/reconnect/lifecycle flush), per-user single-flight flush suppression, backoff retry by re-selecting backoff-ready `failed` operations, and stranded `syncing` recovery on reload. Legacy direct-write retirement and the default-on flip move to 1.9.27; the architecture closeout decision is 1.9.28.
- There is no persistent server idempotency-key ledger. Replays are safe through idempotent operation semantics, but a durable ledger remains a follow-up for stronger duplicate-request auditability.
- Custom-view recompute runs after the atomic write transaction. If recompute fails, the writes remain durable and are reported applied; the projection may remain stale until a later successful recompute.
- 1.9.26 closes the replay-reader gap: the batch flush selects pending plus backoff-ready `failed` operations via `lib/sync/retry-backoff.ts`, and `reconcilePendingWritesOnLoad` resets stranded `syncing` rows to `pending` before flushing. Permanent rejections still stay `failed` and visible, and operations beyond `RETRY_MAX_ATTEMPTS` stop auto-retrying until an explicit retry.
- Concurrent-flush suppression is in-tab single-flight owned by the per-user `useOfflineReplayTrigger` scheduler; cross-tab concurrent flushes (multiple open tabs) are not yet coordinated and remain a follow-up.

**Testing and polish:**
- API-level ownership regression tests now cover the 1.6.x ownership series; owned-flow breadth remains in authenticated E2E.
- Authenticated E2E requires a Supabase user pool with at least as many users as Playwright workers (`tests/.auth/user-<index>.json` plus real env vars), with a legacy single-user fallback only for serial runs.
- No keyboard drag accessibility validation.
- UI/UX polish is intentionally late, after projection correctness, ownership, optimistic behavior, and test baselines.
- Register submit button says "Login".
- Landing page has typo/generic branding.
- `apple-icon.png` is referenced in metadata but missing from `public/`.

**Workflow:**
- Assistant responses can drift if they provide commit, merge, promote, or push commands before the user/controller has supplied validation and status evidence. `docs/WORKFLOW.md` owns the stage-gated response rule.
- Codex debugging attempts can drift if failure classes and hypotheses are not stated before fixes. `docs/CODEX_RULES.md` owns the debugging attempt discipline.
- Never run `git restore <file>` on a file whose intended edit is still uncommitted; commit the file first, or strip only the injected negative-proof line.
- Stable-promotion closeout routes users to the per-file commit commands and final push printed by `promote.ps1`; the assistant should not re-emit those stable promotion commands.
- `open-phase.ps1` requires an explicit `-NextPhase "<version - title>"` or `-NoNextPhase` on every invocation; there is no silent default from the previous STATE.json nextPhase.
- The active product work is the 1.9.26 sync lifecycle, followed by 1.9.27 direct-write retirement and the 1.9.28 architecture closeout, per `docs/FUTURE_PLANS.md`; authenticated E2E requires real Supabase credentials and per-worker storage state.

---

## Next Session Should Do

1. Read `STATE.json`, `codebase-graph.json`, and `docs/FUTURE_PLANS.md` first.
2. Use `docs/CONTEXT_INDEX.md` to choose any additional task-specific read set.
3. Continue the active arc named by `STATE.json.nextPhase` and the first Planned item in `docs/FUTURE_PLANS.md`; do not hardcode a phase number here.
4. Keep `docs/PHASE_LOG.md` historical only. Do not use it as active phase guidance.
5. Preserve the Codex validation boundary.

### Prompt Fence Safety

Do not include nested fenced code blocks inside fenced master prompts. Generated Codex prompts must remain copy-paste safe.

---

## Local Evidence Boundary

ChatGPT reviewer sees pushed GitHub state plus pasted evidence only. It cannot read local uncommitted files, local git status/diff, local-only branches, or local graph changes unless the user/controller pastes that evidence or pushes it.

For source-heavy or local-sensitive scoping, provide a Local Evidence Packet with:
- `git status --short`
- `git log --oneline -5`
- `Get-Content STATE.json`
- `npm run graph:codebase`
- `git diff --stat`

Optional targeted evidence can include file-specific diffs or `Select-String` output from relevant docs. Pasted validation output is evidence, but it does not replace direct file reads when implementation details matter.
