# AI Backlog

## Purpose
Living backlog for future Codex sessions. Keep this updated in every implementation PR.

## Current Implementation
This backlog is organized by risk area. Items are repo-specific and should be revised as the code changes.

## Important Files
- `docs/ai/*.md`: docs that must stay in sync.
- `trpc/routers/*`: API/security backlog.
- `components/list/*`, `components/views/*`: dashboard UX backlog.
- `hooks/useOptimisticSync.ts`, `lib/dashboard-cache.ts`: sync/cache backlog.
- `prisma/schema.prisma`: data/model backlog.

## Data Flow
When implementation work completes:

1. Mark completed backlog items or add follow-ups.
2. Update the relevant feature doc.
3. Add decision-log entries for architectural choices.

## Invariants
- Every future implementation must update the relevant docs and backlog in the same PR.
- Keep security and data-loss risks near the top of execution priority.
- Do not delete unresolved items without explanation.

## Bugs
- Add ownership checks to `listItem.renameListItem`, `deleteListItem`, and `setCompletionListItem`.
- Fix register submit button copy from "Login" to account creation language.
- Fix home page typo "optimisic" and align copy with Tidy branding.
- Verify whether `public/apple-icon.png` exists or remove/update metadata reference.
- Review `tag.removeFromList` duplicate recompute path.

## Tech Debt
- Extract smaller hooks/helpers from `ViewsSidebarPreview`, `ListTagPicker`, `ListComponent`, and `ListsContainer`.
- Consolidate repeated `dashboardKeys` construction.
- Replace broad query invalidation predicate with a typed helper if tRPC exposes a safer option.
- Decide whether tag batching should use shared `useOptimisticSync` scope.
- Add order compaction strategy for long-lived sparse/negative order values.

## Mobile/PWA Readiness
- Add real PWA manifest and icon set.
- Add service worker strategy only after sync durability is designed.
- Validate drag/drop on touch devices.
- Review small-screen card heights and sidebar usability.
- Add mobile viewport manual test checklist or screenshots.

## Production Readiness
- Document required env vars and deployment steps.
- Add rate limiting or abuse controls for write-heavy tRPC procedures.
- Add health/deployment checks for database and Supabase auth.
- Review raw SQL reorder statements for safety and explain ownership prechecks.
- Create migration/backfill playbook for view/list data changes.

## Testing
- Add unit tests for `lib/dashboard-cache.ts`.
- Add tests for `viewHelpers` recompute behavior.
- Add API tests for ownership enforcement.
- Add e2e tests for list creation race, tag recompute, fast view switching, and drag/drop.
- Add build/type/lint validation guidance to CI.

## Observability
- Add production error reporting for failed optimistic sync tasks.
- Add structured logging around tRPC mutation failures without leaking task content.
- Track request counts and latency for reorder/tag/view recompute paths.
- Consider user-visible sync failure state for queued writes.

## Offline-First/Sync Future
- Design durable optimistic queue persistence.
- Define conflict policy for reorder/delete/tag operations after reconnect.
- Add retry/backoff and dead-letter behavior for failed writes.
- Persist enough cache state to reload dashboard offline.

## Performance Cleanup
- Profile large accounts with many lists/items/tags/views.
- Benchmark custom view recompute after tag churn.
- Consider virtualizing very large list grids or item lists.
- Reduce repeated query subscriptions where components fetch the same payload.

## UI Polish
- Improve landing page branding and copy.
- Review empty states for custom views and tagless accounts.
- Improve accessibility labels and keyboard behavior for drag handles.
- Review toast copy and error states.
- Audit compact text wrapping/truncation in list cards and tag menus.

## Documentation Maintenance
- Keep all `docs/ai/*.md` files current with source changes.
- Add diagrams if cache/view flows become more complex.
- Sync or retire older docs in `docs/optimistic-updates.md` and `docs/app-reverse-engineering.md` to avoid drift.
- Add links from `README.md` to `docs/ai/00-ai-entrypoint.md` if future agents rely on it.

## Known Risks
- No automated tests currently prove most optimistic race behavior.
- PWA/offline support is not implemented despite product goals.
- In-memory queues can lose pending writes on refresh or crash.

## What Codex Should Read Before Editing
- Read the backlog section matching the task.
- Read corresponding feature docs before source files.

## What Codex Must Update After Editing
- Mark completed items, add new risks, and add validation follow-ups.
- Keep this file specific to the current repo state.
