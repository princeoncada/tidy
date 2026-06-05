<!-- Current Version: 1.7.3-alpha -->
# AI Handoff

## Current Version / Phase

**Current Version**: 1.7.3-alpha - read `STATE.json` for the machine-readable oracle.
**Current Phase**: 1.7.3 - Refresh/Crash Pending Work Decision
**Next**: 1.8.0 - Local DB Role Audit Through Tests

Use these source-of-truth pointers instead of treating this file as a full history dump:
- `STATE.json` - version, state, phase, phase title, next phase.
- `docs/FUTURE_PLANS.md` - roadmap and next planned backlog item.
- `docs/CONTEXT_INDEX.md` - routing/scoping map for the smallest correct read set.
- `docs/VERSIONING.md` - version rules and version history.
- `docs/PHASE_LOG.md` - historical traceability only, not active implementation guidance.

---

## Latest Completed Change

**1.5.2 - AI Context Budget Audit** promoted the on-demand context budget audit (`npm run budget:context` / `scripts/ai-context-budget.ps1`) to stable. The 1.5.x harness series so far: 1.5.0 added the ai-harness skills and inactive hook contracts, 1.5.1 added the gitignored `.tidy-ai/` local memory and learning queue written by opt-in hooks, and 1.5.2 added the context budget audit. The Codex validation boundary and five-location versioning rules are unchanged.

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
- `app/dashboard/page.tsx` -> `components/Dashboard.tsx` -> `components/list/ListsContainer.tsx`.
- `components/views/ViewsSidebarPreview.tsx` - custom view UI and view selection/reorder behavior.
- `components/list/ListAdder.tsx`, `ListComponent.tsx`, `ListItemComponent.tsx`, `ListTagPicker.tsx` - dashboard list/item/tag workflows.
- `hooks/useOptimisticSync.ts` - module-level write queue.
- `lib/dashboard-cache.ts` - centralized TanStack Query cache helpers.
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
- Dexie/local DB is foundation only. It is not the dashboard source of truth.
- No auto-running sync worker is mounted.
- No outbox replay is wired to dashboard mutations yet.
- Dashboard data still flows through server/TanStack/tRPC.

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
- In-memory optimistic queues can lose pending writes on refresh or crash. Accepted as temporary by design per the 2026-06-05 decision in `docs/DECISIONS.md` (keep in-memory queues; durable pending writes deferred to the 1.8.x local-first series); not a defect to patch in 1.7.x.
- Reorders involving optimistic-only rows must keep filtering optimistic-only IDs before server writes.
- Tag deletes or rapid tag toggles can affect custom view membership mid-operation.
- Fast view switching depends on latest-selected-view guards to avoid stale repaints.
- Immediate item creation after list creation is covered, but nearby optimistic list/tag/item races remain risk areas.
- Inline list/item rename uses component-local edit state; the row remounts when an optimistic row is swapped for its canonical server record, which can drop an in-progress manual rename. Authenticated E2E re-resolves the inline input after entering edit mode and awaits the rename mutation before reload; a product fix (stable row identity or lifted edit state) is a candidate follow-up.
- Optimistic custom-view create can briefly fetch `view.getViewListsWithItems` before `view.create` commits, causing a transient self-healing 404 deferred to a future product phase.

**Local-first and sync:**
- PWA/offline behavior is not implemented despite product goals.
- No conflict policy exists for offline replay.
- Outbox replay helpers exist but are not connected to runtime dashboard mutations.

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
- Product work resumes at the 1.6.x security series; authenticated E2E requires real Supabase credentials and per-worker storage state.

---

## Next Session Should Do

1. Read `STATE.json`, `codebase-graph.json`, and `docs/FUTURE_PLANS.md` first.
2. Use `docs/CONTEXT_INDEX.md` to choose any additional task-specific read set.
3. Continue the 1.5.x workflow-to-skills re-architecture: 1.5.3 makes the skills real and operational under `.claude/skills/`, 1.5.4 deprecates session checkpointing as the continuation mechanism, 1.5.5 adds real opt-in hook guardrails, then 1.5.6 is the Phase Eval Artifact Baseline.
4. Keep `docs/PHASE_LOG.md` historical only. Do not use it as active phase guidance.
5. Preserve the Codex validation boundary.

### Prompt Fence Safety

Do not include nested fenced code blocks inside fenced master prompts. Generated Codex prompts must remain copy-paste safe.

---

## Local Evidence Boundary

ChatGPT architect sees pushed GitHub state plus pasted evidence only. It cannot read local uncommitted files, local git status/diff, local-only branches, or local graph changes unless the user/controller pastes that evidence or pushes it.

For source-heavy or local-sensitive scoping, provide a Local Evidence Packet with:
- `git status --short`
- `git log --oneline -5`
- `Get-Content STATE.json`
- `npm run graph:codebase`
- `git diff --stat`

Optional targeted evidence can include file-specific diffs or `Select-String` output from relevant docs. Pasted validation output is evidence, but it does not replace direct file reads when implementation details matter.
