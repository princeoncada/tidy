<!-- Current Version: 3.2.0 -->
# AI Handoff

## Current Version / Phase

**Current Version**: 3.2.0 - read `STATE.json` for the machine-readable oracle.
**Current Phase**: 3.2.0 - Design Tokens & Dark Mode
**Next**: 3.2.1 - Collapsible Left Sidebar & Canvas Shell

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
- Create, rename, delete, complete, uncomplete, reorder, move, and edit notes on items.
- Create, update, delete, attach, and detach tags.
- Create, edit, delete, select, and reorder custom tag-based views.
- Redeem share links and manage workspaces/list shares.
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
- `components/views/ViewsSidebarPreview.tsx` - custom view UI and view selection/reorder behavior.
- `lib/sync/replicache/*` - keys, mutators, push/pull, CVR diff, and client construction.
- `lib/sync/server-apply.ts`, `lib/sync/sync-batch-contract.ts`, `lib/sync/sync-endpoint-contract.ts` - shared mutation validation and server apply contract used by Replicache push.
- `lib/dashboard/server-read.ts` - user-scoped server graph reads for Replicache pull.
- `lib/dashboard/projection.ts` and `lib/dashboard-cache.ts` - shared projection helpers and retained tRPC cache helper types/tests.
- `lib/collab/*`, `components/list/ItemNotesEditor.tsx`, `app/api/collab/notes/[itemId]/route.ts` - gated per-item Yjs note documents.
- `trpc/routers/*` - retained protected API for auth-adjacent and non-dashboard management flows such as sharing.
- `components/sharing/*`, `lib/sync/permissions.ts`, `app/share/[token]/page.tsx` - sharing role authority, management API, owner controls, and invite redemption.
- `app/manifest.ts`, `public/sw.js`, `components/AppShellServiceWorker.tsx`, `hooks/use-app-shell-service-worker.ts`, `lib/sw/*` - app-shell service worker.
- `app/globals.css`, `lib/theme/tokens.ts`, and `components/theme/*` - additive
  semantic color tokens and root-mounted theme controls.

## Architecture Invariants

**Theme and semantic color layer:**
- Semantic color roles are additive over the existing shadcn variables; shadcn
  primitives remain wired to their original tokens.
- `next-themes` applies the light/dark/system class strategy from the root
  layout, and the account menu owns the theme toggle until the later shell phase.

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
- Committed custom-view reorders write one `View.orderKey`.
- Drag ids are `list-${id}`, `list-item-${id}`, and `list-drop-${id}`.

**Auth and permissions:**
- All dashboard data is scoped by Supabase user id.
- Server-side ownership/effective-role checks are mandatory even when UI only exposes allowed controls.
- `lib/sync/permissions.ts` is the shared server authority for list/item access.
- Sharing management remains protected tRPC traffic; dashboard list/item mutations remain Replicache traffic.
- Collaborative note GET allows any effective list role. Note persistence and Broadcast send require EDITOR or OWNER.

## Forward Arc Invariants (3.0+)

The 3.0 collaboration arc context in `docs/FUTURE_PLANS.md` (3.0 Collaboration Arc) is the owner; this is the implementer-facing pointer:
- One Replicache sync spine serves both web and the future Expo/React Native client (4.0); do not fork a second structural-sync path.
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
- Hardcoded colors outside the migrated dashboard chrome remain for later
  visual phases; auth, landing, shadcn primitives, and product-data tag colors
  were intentionally not included in 3.2.0.
- Theme tokens: do not override a shadcn primitive's background (for example,
  `DropdownMenuContent`, `Card`, or `Dialog`) with a semantic `bg-*` utility;
  tailwind-merge will not dedupe it against the primitive's `bg-popover` or
  `bg-card` and the surface drops out. Primitives keep their shadcn surface
  tokens; feature chrome uses semantic utilities.

## Validation Boundary

Codex implementation phases do not run validation, graph, build, git, or npm scripts. The user/controller runs the validation commands from `docs/CODEX_RULES.md` and the phase prompt.
- ChatGPT reviewer sees pushed GitHub state plus pasted evidence only
- Do not include nested fenced code blocks inside fenced master prompts.
