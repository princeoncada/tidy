<!-- Current Version: 2.0.9-alpha -->
# AI Handoff

## Current Version / Phase

**Current Version**: 2.0.9-alpha - read `STATE.json` for the machine-readable oracle.
**Current Phase**: 2.0.9 - Retire Legacy Overlay / Outbox-Render / tRPC-Render Paths
**Next**: 2.1.0 - Deploy Env Documentation

Use these source-of-truth pointers instead of treating this file as a full history dump:
- `STATE.json` - version, state, phase, phase title, next phase.
- `docs/FUTURE_PLANS.md` - roadmap and next planned backlog item.
- `docs/CONTEXT_INDEX.md` - routing/scoping map for the smallest correct read set.
- `docs/VERSIONING.md` - version rules and current state; completed-version history lives in `docs/FUTURE_PLANS.md` Completed.
- `docs/PHASE_LOG.md` - historical traceability only, not active implementation guidance.

## Current Product Snapshot

Tidy is an authenticated personal todo workspace with Replicache-backed optimistic local rendering.

**User actions**:
- Create, rename, delete, reorder, and share lists.
- Create, rename, delete, complete, uncomplete, reorder, move, and edit notes on items.
- Create, update, delete, attach, and detach tags.
- Create, edit, delete, select, and reorder custom tag-based views.
- Redeem share links and manage workspaces/list shares.

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
- `components/views/ViewsSidebarPreview.tsx` - custom view UI and view selection/reorder behavior.
- `lib/sync/replicache/*` - keys, mutators, push/pull, CVR diff, and client construction.
- `lib/sync/server-apply.ts`, `lib/sync/sync-batch-contract.ts`, `lib/sync/sync-endpoint-contract.ts` - shared mutation validation and server apply contract used by Replicache push.
- `lib/dashboard/server-read.ts` - user-scoped server graph reads for Replicache pull.
- `lib/dashboard/projection.ts` and `lib/dashboard-cache.ts` - shared projection helpers and retained tRPC cache helper types/tests.
- `lib/collab/*`, `components/list/ItemNotesEditor.tsx`, `app/api/collab/notes/[itemId]/route.ts` - gated per-item Yjs note documents.
- `trpc/routers/*` - retained protected API for auth-adjacent and non-dashboard management flows such as sharing.
- `components/sharing/*`, `lib/sync/permissions.ts`, `app/share/[token]/page.tsx` - sharing role authority, management API, owner controls, and invite redemption.
- `app/manifest.ts`, `public/sw.js`, `components/AppShellServiceWorker.tsx`, `hooks/use-app-shell-service-worker.ts`, `lib/sw/*` - app-shell service worker.

## Architecture Invariants

**Replicache is the only dashboard render/write path:**
- The dashboard always mounts `ReplicacheProvider` for an authenticated user after local boot identifies the user.
- Dashboard components render from `useReplicacheDashboard`; they do not query tRPC payloads, apply pending outbox overlays, or write TanStack dashboard caches for live list/item/tag/view mutations.
- Dashboard writes call named Replicache mutators through `useDashboardMutations`.
- tRPC routers remain in the app for retained management/auth flows; do not delete tRPC wholesale.

**Data model and ordering:**
- Core models: `List`, `ListItem`, `Tag`, `View`, `ViewList`, `ViewTag`, `ListTag`.
- Sharing models: `Workspace`, `WorkspaceMember`, `ListShare`, and `ShareLink`.
- `ItemNoteDoc` is a one-to-one binary Yjs document keyed by `ListItem.id`. It is not a Replicache entity; `ListItem.notes` remains the plain-text read projection.
- Live dashboard ordering is owned by fractional order keys: `View.orderKey`, `ViewList.orderKey`, and `ListItem.orderKey`.
- Integer `order` fields are retained for schema/backfill compatibility and historical helper types, but they are not the live dashboard ordering authority.
- Replicache keys are `list/{id}`, `listItem/{id}`, `tag/{id}`, `view/{id}`, `viewList/{viewId}/{listId}`, `viewTag/{viewId}/{tagId}`, `listTag/{listId}/{tagId}`, and `metadata/selectedView`.

**Sync and projection:**
- Replicache pull converts the server graph into key/value patches and uses CVR hashes to emit `put`/`del` changes.
- Replicache push translates named mutators into the existing operation decision shape and applies them through `server-apply.ts` inside a Prisma transaction with `lastMutationID` advancement.
- Rejected Replicache mutations advance as no-op background corrections; the next pull rebases local optimistic state.
- Supabase Broadcast pokes are doorbells only. Missed pokes self-heal on the periodic Replicache pull.
- `lib/dashboard/projection.ts` preserves ALL_LISTS, CUSTOM ALL/ANY, UNTAGGED, per-view order fallback, and deterministic tie-breaking.
- Shared lists are computed at pull time from effective access. Recipient entries include items and effective role but keep owner tags/custom views private.

**Drag and drop:**
- Drag hover is local-only; no cache/server writes happen during hover.
- Committed list drops write one `ViewList.orderKey`.
- Committed item reorders write one `ListItem.orderKey`.
- Committed cross-list movement writes the moved item `listId` plus `orderKey`.
- Committed custom-view reorders write one `View.orderKey`.
- Drag ids are `list-${id}`, `list-item-${id}`, and `list-drop-${id}`.

**Auth and permissions:**
- All dashboard data is scoped by Supabase user id.
- Server-side ownership/effective-role checks are mandatory even when UI only exposes allowed controls.
- `lib/sync/permissions.ts` is the shared server authority for list/item access.
- Sharing management remains protected tRPC traffic; dashboard list/item mutations remain Replicache traffic.
- Collaborative note GET allows any effective list role. Note persistence and Broadcast send require EDITOR or OWNER.

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

- Fractional key backfill must complete before assuming every persisted row has a stored key; pull fallbacks prevent null keys from entering Replicache state during rollout.
- Replicache correction surfacing is currently limited to push correction accounting and pull rebasing. Do not reintroduce the retired local-outbox status UI for this.
- Shared-list recipient ordering and tag/custom-view sharing remain intentionally deferred.
- Collaborative notes require the manually applied per-item Realtime RLS policy.
- Repeating the full authenticated suite across multiple app processes can still exhaust the external Postgres session pool; connection hygiene remains a candidate follow-up.
- `package.json` still owns script naming and cannot be changed by Codex implementation phases that explicitly prohibit package edits.

## Validation Boundary

Codex implementation phases do not run validation, graph, build, git, or npm scripts. The user/controller runs the validation commands from `docs/CODEX_RULES.md` and the phase prompt.
