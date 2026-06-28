<!-- Current Version: 3.6.4-alpha -->
# AI Handoff

## Current Version / Phase

**Current Version**: 3.6.4-alpha - read `STATE.json` for the machine-readable oracle.
**Current Phase**: 3.6.4 - Workspace OS Rebase RFC
**Next**: 4.0.0 - Workspace OS Product Model Rebase

Use these source-of-truth pointers instead of treating this file as a full history dump:
- `STATE.json` - version, state, phase, phase title, next phase.
- `docs/FUTURE_PLANS.md` - roadmap and next planned backlog item.
- `docs/CONTEXT_INDEX.md` - routing/scoping map for the smallest correct read set.
- `docs/VERSIONING.md` - version rules, current state, and the completed-version history table.
- `docs/PHASE_LOG.md` - historical traceability only, not active implementation guidance.

## Current Product Snapshot

Tidy is an authenticated personal todo workspace with Replicache-backed optimistic local rendering.

**User actions**:
- Create, rename, delete, reorder, and share lists.
- Create, rename, delete, complete, uncomplete, set status, assign/unassign,
  reorder, move, and edit notes on items.
- View the flag-gated multiplayer board grouped by item status and drag cards
  across status columns.
- Create, update, delete, attach, and detach tags.
- Create, edit, delete, select, and reorder custom tag-based views.
- Redeem share links and manage workspaces/list shares.
- View a read-only history of recent changes (flag-gated).
- Switch the app theme among light, dark, and system from the account menu.

**Routes**:
- `/` - landing card.
- `/register`, `/login`, `/forgot-password`, `/reset-password` - Supabase auth.
- `/auth/confirm`, `/api/auth/confirm` - Supabase callbacks.
- `/dashboard` - authenticated app guarded by `proxy.ts`.
- `/api/replicache/push`, `/api/replicache/pull` - protected Replicache sync endpoints.
- `/api/collab/notes/[itemId]` - protected collaborative note document endpoint.

**Key files**:
- `app/dashboard/page.tsx` -> `components/Dashboard.tsx` -> `components/ReplicacheProvider.tsx`.
- `hooks/useReplicacheDashboard.ts` - subscribes to the per-user Replicache store and projects the dashboard graph.
- `hooks/useDashboardMutations.ts` - exposes Replicache mutators to dashboard components.
- `components/list/ListsContainer.tsx`, `ListAdder.tsx`, `ListComponent.tsx`, `ListItemComponent.tsx`, `ListTagPicker.tsx` - dashboard list/item/tag UI.
- `components/board/*`, `lib/board/*` - flag-gated board UI and per-status board ordering helpers.
- `components/views/ViewsSidebarPreview.tsx` - custom view UI and view selection/reorder behavior.
- `components/layout/*` - authenticated dashboard sidebar and canvas shell.
- `lib/sync/replicache/*` - keys, mutators, push/pull, CVR diff, and client construction.
- `lib/sync/server-apply.ts`, `lib/sync/sync-batch-contract.ts`, `lib/sync/sync-endpoint-contract.ts` - shared mutation validation and server apply contract used by Replicache push.
- `lib/dashboard/server-read.ts` - user-scoped server graph reads for Replicache pull.
- `lib/dashboard/projection.ts` and `lib/dashboard-cache.ts` - shared projection helpers and retained tRPC cache helper types/tests.
- `lib/collab/*`, `components/item/ItemNotesField.tsx`, `app/api/collab/notes/[itemId]/route.ts` - gated per-item Yjs note documents (the notes field is hosted by the item detail panel).
- `components/item/ItemDetailPanel.tsx`, `lib/item-panel/item-panel-gate.ts` - centered item detail panel hosting item metadata and the collaborative notes field, gated by `NEXT_PUBLIC_ITEM_PANEL_ENABLED` (default off); opened per item from `components/list/ListItemComponent.tsx`.
- `lib/history/*`, `components/history/HistoryPanel.tsx`, `trpc/routers/historyRouter.ts`, `trpc/routers/revertRouter.ts` - gated mutation history and replay-based revert (`NEXT_PUBLIC_HISTORY_ENABLED`, default off) over `MutationLedgerEntry`.
- `trpc/routers/*` - retained protected API for auth-adjacent and non-dashboard management flows such as sharing.
- `components/sharing/*`, `lib/sync/permissions.ts`, `lib/sharing/user-directory.ts`, `app/share/[token]/page.tsx` - sharing role authority, management API, server-only identity-label directory, owner controls, and invite redemption.
- `app/manifest.ts`, `public/sw.js`, `components/AppShellServiceWorker.tsx`, `hooks/use-app-shell-service-worker.ts`, `lib/sw/*` - app-shell service worker.
- `app/globals.css`, `lib/theme/tokens.ts`, and `components/theme/*` - additive
  semantic color tokens and root-mounted theme controls.

## Architecture Invariants

**Theme and semantic color layer:**
- Semantic color roles are additive over the existing shadcn variables; shadcn
  primitives remain wired to their original tokens.
- `next-themes` applies the light/dark/system class strategy from the root
  layout, and the account menu owns the theme toggle.

**Authenticated dashboard shell:**
- The collapsible left sidebar and canvas shell wraps the authenticated dashboard;
  collapse/expand does not remount or reset the dashboard data surface.
- The expanded sidebar's Workspaces and Views navigation uses independent inline
  accordion sections rather than floating dropdowns. Each section owns its
  internal scroll, in-section add, and in-section drag reorder; expanding one
  pushes lower sections down in the sidebar flow. The accordion triggers carry
  the section titles; expanded panels omit redundant labels and show only a
  right-aligned control labelled "Add". Add List and both section triggers use
  one uniform vertical gap.
- Workspace rows mirror custom-view rows with a grip handle, name, and trailing
  ellipsis menu; they do not render a leading per-row icon. The menu exposes a
  small rename dialog and delete action.
- Selected sidebar default buttons, workspace rows, and custom-view rows use the
  `border-strong` emphasis border plus a check indicator, not a selection-fill
  recolor.
- From the collapsed desktop rail, activating the footer account avatar first
  expands the sidebar and then opens the upward account-menu dropdown.
- Below `lg`, the sidebar is a focus-trapping Radix Dialog drawer that returns
  focus to its trigger. The canvas main retains `data-testid="app-shell"`, and
  the theme toggle remains in the account menu.

**Replicache is the only dashboard render/write path:**
- The dashboard always mounts `ReplicacheProvider` for an authenticated user after local boot identifies the user.
- Dashboard components render from `useReplicacheDashboard`; they do not query tRPC payloads, apply pending outbox overlays, or write TanStack dashboard caches for live list/item/tag/view mutations.
- Dashboard writes call named Replicache mutators through `useDashboardMutations`.
- tRPC routers remain in the app for retained management/auth flows; do not delete tRPC wholesale.

**Data model and ordering:**
- Core models: `List`, `ListItem`, `Tag`, `View`, `ViewList`, `ViewTag`, `ListTag`.
- Sharing models: `Workspace`, `WorkspaceMember`, `ListShare`, and `ShareLink`.
- `MutationLedgerEntry` is the append-only history ledger keyed by `id`, guarded
  by unique `(clientId, mutationId)`, and intentionally has no foreign key to
  `ReplicacheClientGroup` so history can survive client-group pruning. Read-only
  history is exposed via the history tRPC router and gated HistoryPanel in
  3.5.1; 3.5.2 adds replay-based, flag-gated revert through
  `revertToLedgerEntry`, reconstructing prior state from the userId-scoped
  ledger and writing corrective operations through server-apply with the
  existing poke.
- `ItemNoteDoc` is a one-to-one binary Yjs document keyed by `ListItem.id`. It is not a Replicache entity; `ListItem.notes` remains the plain-text read projection.
- `ListItem` has `status` (`ItemStatus`: `TODO`, `IN_PROGRESS`, `DONE`, default
  `TODO`), nullable `assigneeId`, and nullable `boardOrderKey`.
  `boardOrderKey` is the per-status board ordering authority across the current
  view; legacy nulls sort after stored board keys with list-order/id fallback
  until a deterministic backfill removes the rollout window. Assignee ids are
  Supabase user ids and are validated against `getUsersWithListAccess` on the
  server apply path.
- Live dashboard ordering is owned by fractional order keys: `View.orderKey`, `ViewList.orderKey`, and `ListItem.orderKey`.
- Owned workspace navigation order uses nullable `Workspace.orderKey` and a
  protected, single-row `reorderWorkspace` tRPC mutation. Workspaces remain
  management entities outside Replicache.
- Workspace rename and delete use protected, owner-checked `renameWorkspace`
  and `deleteWorkspace` tRPC mutations on the same management lane as
  `reorderWorkspace`. Deleting a workspace relies on `List.workspaceId`
  `onDelete: SetNull`, causing affected lists to fall back to "All workspaces",
  and the client triggers a Replicache pull after deletion.
- Integer `order` fields are retained for schema/backfill compatibility and historical helper types, but they are not the live dashboard ordering authority.
- Replicache keys are `list/{id}`, `listItem/{id}`, `tag/{id}`, `view/{id}`, `viewList/{viewId}/{listId}`, `viewTag/{viewId}/{tagId}`, `listTag/{listId}/{tagId}`, and `metadata/selectedView`.
- The `listItem/{id}` Replicache value shape is
  `id/name/completed/status/assigneeId/order/boardOrderKey/notes/listId/createdAt/updatedAt`.

**Sync and projection:**
- Replicache pull converts the server graph into key/value patches and uses CVR hashes to emit `put`/`del` changes.
- Replicache push translates named mutators into the existing operation decision shape and applies them through `server-apply.ts` inside a Prisma transaction with `lastMutationID` advancement.
- Replicache push appends one `MutationLedgerEntry` per mutation that actually
  applied a state change, not for no-op already-applied mutations or
  rejected/rolled-back mutations, inside the same per-mutation transaction as
  the `lastMutationID` advance. 3.5.1 adds the read-only history path through
  the history tRPC router and gated HistoryPanel; 3.5.2 adds replay-based,
  flag-gated `revertToLedgerEntry`, reconstructing prior state from the
  userId-scoped ledger and writing corrective operations through server-apply
  with the existing poke.
- Revert reuses the pure `replicacheMutators` for replay and
  `applyAcceptedSyncOperationsWithinTransaction` for write-back; it does not
  alter pull/push/poke semantics.
- Item `status`, `assigneeId`, and `boardOrderKey` sync through the existing
  partial-field `updateItem` mutator and CVR list-item projection; status is
  validated against the enum, `boardOrderKey` must be non-empty when provided,
  and non-null assignees must be users with access to the parent list.
- View-create is idempotent for sequential/duplicate pushes via two layers: the push handler's `lastMutationID` dedup and server-apply's `findUnique(id)` guard (`already-applied` for the same user, rejected for another user's id) before `tx.view.create`. A concurrent same-id push could in principle race to a P2002 -> 500, but this is unreproducible in the mock-only server test layer and is prevented by the Replicache client's per-client push serialization; addressing it would require a transaction-abort/savepoint-aware change. This residual is accepted and deferred in `docs/FUTURE_PLANS.md` Potential Next Directions.
- Rejected Replicache mutations advance as no-op background corrections; the next pull rebases local optimistic state.
- Supabase Broadcast pokes are doorbells only. Missed pokes self-heal on the periodic Replicache pull.
- `lib/dashboard/projection.ts` preserves ALL_LISTS, CUSTOM ALL/ANY, UNTAGGED, per-view order fallback, and deterministic tie-breaking.
- Shared lists are computed at pull time from effective access. Recipient entries include items and effective role but keep owner tags/custom views private.

**Drag and drop:**
- Drag hover is local-only; no cache/server writes happen during hover.
- Committed list drops write one `ViewList.orderKey`.
- Committed item reorders write one `ListItem.orderKey`.
- Committed cross-list movement writes the moved item `listId` plus `orderKey`.
- After a committing list/item drop, the optimistic drag preview is held until the projected dashboard `lists` converges to the committed placement (confirm-before-relinquish), with a 1500ms fallback relinquish, so cross-list item moves do not snap back to the source.
- Committed custom-view reorders write one `View.orderKey`.
- Drag ids are `list-${id}`, `list-item-${id}`, and `list-drop-${id}`.

**Multiplayer board:**
- The board is gated by `NEXT_PUBLIC_BOARD_ENABLED` and defaults off; the
  dashboard defaults to list mode even when the flag is enabled.
- The board renders the current view's workspace-filtered items from
  `useReplicacheDashboard`, grouped into TODO, IN_PROGRESS, and DONE columns.
- Board writes use only `useDashboardMutations().mutate.updateItem` with the
  existing Replicache `updateItem` mutator; dragging a card to another column
  changes `status` and dragging within a column updates `boardOrderKey`.
- Board status labels are text, not color-only. The board does not toggle
  `completed` when status changes.
- Legacy rows with null `boardOrderKey` are client-sorted after stored board
  keys by list order and id. A one-time deterministic backfill is deferred.
- The board renders a progress summary (`components/board/BoardSummary.tsx`)
  above the columns: completion percentage (DONE over total) plus per-column
  counts and a total, computed by `lib/board/board-rollup.ts` from the
  committed, workspace-filtered synced groups (`boardData.groups`), not the
  in-flight drag preview.

**Auth and permissions:**
- All dashboard data is scoped by Supabase user id.
- Server-side ownership/effective-role checks are mandatory even when UI only exposes allowed controls.
- `lib/sync/permissions.ts` is the shared server authority for list/item access.
- Sharing management remains protected tRPC traffic; dashboard list/item mutations remain Replicache traffic.
- Member and assignee identity labels are resolved server-side only, inside
  the already-authorized `share.listMembers` and
  `listItem.getAssignableMembers` queries; the client never receives a bulk
  user directory and no new permission surface is added.
- Collaborative note GET allows any effective list role. Note persistence and Broadcast send require EDITOR or OWNER.

## Forward Arc Invariants (3.0+)

These are the durable runtime invariants carried forward from the completed 3.0-3.5 collaboration arc (version history in `docs/VERSIONING.md`); forward product direction is owned by the 4.0 Workspace OS Rebase Arc in `docs/FUTURE_PLANS.md`. This is the implementer-facing pointer:
- One Replicache sync spine is the sole structural-sync path; do not fork a second structural-sync path. A future native/mobile client is deferred 4.0 Workspace OS work (see the 4.0 Workspace OS Rebase Arc deferral boundary in `docs/FUTURE_PLANS.md`) and must reuse this spine rather than introduce a parallel one.
- Structural sync (lists/items/board via Replicache) and ephemeral presence (cursors/typing/who-is-here) ride SEPARATE transports. Presence must not be coupled into the Replicache push/pull path.
- The existing workspace model is KEPT, not replaced.
- From 3.0.4, UI/design is governed by `docs/design.md` as the single source of truth.

## Active 3.1.0 Sync Latency Spike

- `lib/sync/sync-latency-spike.ts` contains temporary, development-only instrumentation gated by browser local storage key `tidy:sync-latency-spike=1`; it is disabled by default and always disabled in production.
- The gated path records bounded in-memory events at local mutation, push, poke, pull, and generated-marker DOM-render boundaries. It records identifiers, counts, stages, and timestamps only; it does not alter replicated data or wire contracts.
- `docs/spikes/3.1.0-sync-latency-measurement.md` owns the two-profile measurement protocol, result tables, limitations, and removal steps.
- Configured `smoke-004` measured 22,078 ms end-to-end through periodic pull, with an 18,168 ms wait after push before the peer pull began and no peer `poke_received` event.
- 3.1.1 fixed the private-channel REST mismatch: `pokeUser()` now sends `private: true` on the broadcast message (matching the private client subscription) and returns a structured delivery result plus a `console.warn` instead of masking non-success HTTP responses. A post-fix representative trial verified poke delivery is restored (end-to-end 22,078 ms -> ~4,094 ms). The gated instrumentation is RETAINED (not removed at 3.1.1 close) as the 3.1.2 harness data source. See the spike report for the protocol and deferred removal steps.
- 3.1.2 adds `tests/e2e/sync-latency.spec.ts`, a Supabase-admin/Prisma shared-workspace seed helper, pure metric utilities, and the opt-in `npm run test:e2e:latency` script. It drives the retained instrumentation in owner/editor contexts for Baseline, Moderate Load, and Burst, writes per-scenario raw local artifacts under `.tidy-ai/sync-latency/`, and fills each selected Results table with `SYNC_LATENCY_WRITE_REPORT=1`.

## Active 3.4.3 Presence Transport Hardening

- `lib/realtime/presence-client.ts` (`PresenceRoom`) is the minimal production presence transport; `lib/realtime/presence-topic.ts` builds the `tidy:presence:<listId>` topic. `lib/realtime/presence-dev-harness.ts` is a development-only window proof harness gated by browser local storage key `tidy:presence-spike=1`, disabled by default and always disabled in production.
- The gated path opens a private `tidy:presence:<roomId>` Supabase Realtime channel, uses Presence for the who-is-here roster, uses Broadcast for cursor/typing signals, and keeps all spike data in bounded browser memory.
- Separation invariant: presence does not touch Replicache push/pull, `server-apply`, `/api/replicache/*`, CVR state, tRPC dashboard mutations, persisted data, or replicated entity fields.
- `docs/spikes/3.4.0-presence-transport-spike.md` owns the two-profile feasibility proof protocol, limitations, open questions, and removal steps. `docs/DECISIONS.md` records the durable transport decision.
- Presence access is permission-scoped: `prisma/sql/3_4_3_realtime_presence_rls.sql` (controller-run) authorizes `tidy:presence:<listId>` via a SECURITY DEFINER list-membership check (roomId = listId), replacing the 3.4.0 permissive dev policy. The presence UI is 3.4.4.
- PROOF DONE (2026-06-24): the two-user feasibility proof ran + is recorded in the spike doc Results. Transport PROVEN (roster join + cursor/typing broadcast across two profiles). Two findings are now 3.4.3 scope: (1) the private presence channel needs PERMISSION-SCOPED RLS on `realtime.messages` (a SECURITY DEFINER room-membership check; a permissive dev policy is currently LIVE in Supabase and must be replaced + dropped), and (2) `leave()` must `untrack()` before `removeChannel()` or peers keep a sticky roster entry.

## Removed Legacy Paths

2.0.9 retires the old dashboard compatibility paths:
- No Replicache render env gate.
- No offline-write prototype env gate.
- No dashboard tRPC render branch.
- No pending outbox overlay before render.
- No local outbox write-capture/replay worker.
- No `/api/sync` dashboard batch endpoint.
- No Sync Status badge backed by local outbox state.

Keep these because Replicache still uses them:
- `lib/sync/server-apply.ts`
- `lib/sync/sync-batch-contract.ts`
- `lib/sync/sync-endpoint-contract.ts`
- `lib/local-db/outbox-schema.ts`
- `lib/sync/replicache/*`
- `lib/collab/*`
- `app/api/replicache/*`
- `app/api/collab/*`

## Known Risks

- The item detail panel and its notes field are flag-gated (`NEXT_PUBLIC_ITEM_PANEL_ENABLED` default off; notes also gated by the Yjs notes flag). The inline notes expander was removed in 3.3.0; the Yjs note path and `ItemNoteDoc` projection are unchanged.
- Item assignees are restricted to current list-access members. As of 3.4.2,
  assignee and shared-member identities are labelled by a server-only
  identity-directory lookup (`lib/sharing/user-directory.ts`) over the
  Supabase service-role GoTrue admin REST endpoint, with a raw user-id
  fallback when the service role is unset; no display-name data is persisted.
  Board grouping on item status is implemented behind
  `NEXT_PUBLIC_BOARD_ENABLED`, with legacy-null `boardOrderKey` fallback until
  the deferred deterministic backfill runs.
- Create-path idempotency (3.2.9): every create in `lib/sync/server-apply.ts` (list, listItem, tag, view) wraps `tx.<entity>.create` in a Postgres SAVEPOINT via `createWithinSavepoint`; a unique-constraint (P2002) abort rolls back only the nested savepoint and maps to `already-applied`, so a post-reload replay racing the original push no longer 500s the push route. Tag/view conflicts re-query by id to keep the existing "belongs to another user" / name-conflict rejects. Do not revert creates to bare `findUnique -> create`, and keep the view `isDefault` sweep AFTER a confirmed insert (excluding the new id) so an id-race cannot blank the default flag.
- Fractional key backfill must complete before assuming every persisted row has a stored key; pull fallbacks prevent null keys from entering Replicache state during rollout.
- Replicache correction surfacing is currently limited to push correction accounting and pull rebasing. Do not reintroduce the retired local-outbox status UI for this.
- Shared-list recipient ordering and tag/custom-view sharing remain intentionally deferred.
- Collaborative notes require the manually applied per-item Realtime RLS policy.
- Repeating the full authenticated suite across multiple app processes can still exhaust the external Postgres session pool; connection hygiene remains a candidate follow-up.
- `package.json` still owns script naming and cannot be changed by Codex implementation phases that explicitly prohibit package edits.
- Hardcoded colors outside the migrated dashboard chrome remain for later
  visual phases; auth, landing, shadcn primitives, and product-data tag colors
  were intentionally not included in 3.2.0.
- Theme tokens: do not override a shadcn primitive's background (for example,
  `DropdownMenuContent`, `Card`, or `Dialog`) with a semantic `bg-*` utility;
  tailwind-merge will not dedupe it against the primitive's `bg-popover` or
  `bg-card` and the surface drops out. Primitives keep their shadcn surface
  tokens; feature chrome uses semantic utilities.
- Concurrent-pull partial entity shapes are null-safe on BOTH sync sides as of 3.2.8: the server CVR builder (`lib/sync/replicache/pull-cvr.ts` `buildReplicacheClientView`) normalizes its collection iteration, and the client `hooks/useReplicacheDashboard.ts` `assembleReplicacheDashboard` null-safes its id/tag sort comparisons. A transient incomplete pull no longer 500s the pull route or crashes dashboard assembly; both are covered by unit tests. Residual: `tests/e2e/drag-drop.spec.ts` "reorder lists inside a custom view persists after reload" is convergence-SPEED flaky on its post-reload assertion under a saturated local Postgres session pool. The data always converges to the correct order (verified by failure page snapshots), so this is test/env timing, not a correctness bug; characterize and harden it on a clean environment rather than by widening assertion timeouts. See also the auth-suite pool-exhaustion note above.

## Validation Boundary

Codex implementation phases do not run validation, graph, build, git, or npm scripts. The user/controller runs the validation commands from `docs/CODEX_RULES.md` and the phase prompt.
- ChatGPT reviewer sees pushed GitHub state plus pasted evidence only
- Do not include nested fenced code blocks inside fenced master prompts.
