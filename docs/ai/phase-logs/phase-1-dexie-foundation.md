# Phase 1: Dexie Foundation

## Goal
Add the local-first foundation in small validated checkpoints without changing runtime behavior until the integration checkpoint.

## Current Baseline
Tidy already has optimistic updates, TanStack Query cache coordination, debounced reorder saves, dnd-kit drag/drop, and tRPC server persistence.

Current pending writes are not durable across refresh, crash, or offline state. Phase 1 starts by adding Dexie foundation pieces safely before UI integration.

## Branch Structure
- Umbrella branch: `phase/dexie-foundation`
- Checkpoint branches branch from `phase/dexie-foundation`.
- Checkpoint branches merge back into `phase/dexie-foundation` only after validation.
- `phase/dexie-foundation` merges into `master` only after all Phase 1 checkpoints pass.

Checkpoint branches:

- `checkpoint/docs-roadmap`
- `checkpoint/install-dexie-db-shell`
- `checkpoint/local-schema-types`
- `checkpoint/outbox-operation-types`
- `checkpoint/local-repository-helpers`
- `checkpoint/sync-status-model`
- `checkpoint/first-dexie-integration`
- `checkpoint/expand-dexie-coverage`

## Checkpoint Rules
- One checkpoint = one narrow concern.
- Do not combine dependency install, schema, repositories, UI integration, and sync behavior in one checkpoint.
- Keep docs, runtime code, tests, and validation updates in separate commits where practical.
- Runtime checkpoints must add or update matching tests in the same branch.
- Docs-only checkpoints do not need new tests unless they change test infrastructure.
- Every checkpoint must update this phase log with files changed, validation run, risks, and next step.

## Phase 1 Checkpoint Plan

### 1. checkpoint/docs-roadmap
Purpose:

- Create this phase log.
- Link Phase 1 from the AI entrypoint/backlog if needed.
- No runtime behavior change.

Validation:

- `git status`
- `git diff --stat`
- Confirm only `docs/ai` files changed.
- No package files changed.
- No runtime source changed.

### 2. checkpoint/install-dexie-db-shell
Purpose:

- Install Dexie.
- Create local DB shell only.
- Do not connect UI yet.

Expected validation:

- `npm install`
- `npm run test:ci`
- `npm run build` if environment supports it.
- Manual app smoke through `npm run dev` if available.

### 3. checkpoint/local-schema-types
Purpose:

- Define local entity types and table shape.
- Keep server schema unchanged.
- No UI integration yet.

Expected validation:

- `npm run typecheck`
- `npm run test`
- `npm run test:ci` when practical.

### 4. checkpoint/outbox-operation-types
Purpose:

- Define outbox operation types.
- Include `operationId`, `entityType`, `operationType`, `payload`, `status`, `retryCount`, and timestamps.
- No sync worker yet.

Expected validation:

- `npm run typecheck`
- `npm run test`
- Unit tests if helper logic is introduced.

### 5. checkpoint/local-repository-helpers
Purpose:

- Add local repository helper functions.
- Keep helpers pure and isolated.
- Do not replace existing TanStack/tRPC flow yet.

Expected validation:

- Add/update unit tests for helper behavior.
- `npm run test`
- `npm run test:ci` when practical.

### 6. checkpoint/sync-status-model
Purpose:

- Add sync status model only.
- Define `local`, `pending`, `syncing`, `synced`, and `failed`.
- No user-facing sync UI yet unless explicitly scoped.

Expected validation:

- `npm run typecheck`
- `npm run test`
- Update docs if model semantics change.

### 7. checkpoint/first-dexie-integration
Purpose:

- Connect one small low-risk feature to Dexie.
- Keep existing server behavior compatible.
- Do not rewrite drag/drop or all mutations.

Expected validation:

- Add/update tests matching the changed behavior.
- `npm run test:ci`
- Authenticated E2E if the changed behavior touches dashboard persistence and credentials are available.
- Manual dashboard check from `docs/testing-validation.md`.

### 8. checkpoint/expand-dexie-coverage
Purpose:

- Expand local-first coverage only after first integration is stable.
- Keep scope controlled.
- Do not introduce full sync worker unless this branch is explicitly re-scoped.

Expected validation:

- Add/update tests matching the changed behavior.
- `npm run test:ci`
- `npm run test:e2e:auth` when credentials/storage state are available.
- Manual drag/drop, refresh, and rapid-action validation.

## Validation Source Of Truth
Do not duplicate the full testing rules here.

Reference these docs instead:

- `docs/testing-validation.md`
- `docs/testing.md`
- `ai-docs/testing-workflow.md`
- `docs/ai/13-testing-and-validation.md`

Validation rules for Phase 1:

- `npm run test:ci` is the default implementation validation command.
- Authenticated dashboard E2E requires `tests/.auth/user.json`, real Supabase public env vars, and `DATABASE_URL`.
- If authenticated E2E cannot run, document the exact missing credential/service.
- Do not silently skip dashboard-auth validation for dashboard behavior.

## Manual Phase 1 Regression Checklist
Use this list when runtime behavior changes:

- App starts with `npm run dev`.
- User can log in.
- Dashboard loads existing data.
- Create, rename, delete, and refresh a list.
- Create, rename, delete, and refresh an item.
- Reorder items within the same list.
- Move an item across lists.
- Drop an item into an empty list.
- Reorder lists.
- Switch views.
- Create tag/view filtering still works.
- Rapid create/rename/reorder does not duplicate or lose records.
- Refresh after actions keeps the expected state.
- Browser console has no new Dexie, hydration, dnd-kit, tRPC, or React errors.
- Network tab does not show unexpected request spam.

## Merge Gate
A checkpoint can merge into `phase/dexie-foundation` only when:

- Scope stayed inside the checkpoint.
- Required docs were updated.
- Required tests were added or updated for runtime changes.
- Required validation commands were run or skipped with exact reason.
- No unrelated source churn exists.
- Known risks are written in this phase log.

`phase/dexie-foundation` can merge into `master` only when:

- All checkpoints are complete or intentionally deferred.
- `npm run test:ci` passes.
- `npm run build` passes where environment supports it.
- Authenticated E2E was run if dashboard behavior changed and credentials are available.
- Manual dashboard validation is documented.
- No partially working local-first/sync system is merged.

## Non-Goals For Phase 1
- Do not implement Redis.
- Do not implement Sentry.
- Do not implement QStash.
- Do not implement Inngest.
- Do not implement full CRDT/multiplayer sync.
- Do not rewrite drag/drop.
- Do not rewrite all tRPC endpoints.
- Do not make Dexie the full source of truth until integration is intentionally scoped.
- Do not merge unstable sync behavior into master.

## Checkpoint Log

### checkpoint/docs-roadmap
- Status: Ready for review.
- Date: 2026-05-10.
- Files changed: `docs/ai/phase-logs/phase-1-dexie-foundation.md`, `docs/ai/00-ai-entrypoint.md`, `docs/ai/backlog.md`.
- Validation run: File review, `git status --short --branch`, `git diff --stat`, and scope check.
- Manual validation: Confirmed this checkpoint is documentation-only and references existing testing docs instead of duplicating them.
- Known risks: Later runtime checkpoints can still overreach unless each branch keeps to one narrow concern and updates this log before merge.
- Next checkpoint: `checkpoint/install-dexie-db-shell`.

### checkpoint/install-dexie-db-shell
- Status: Ready for review.
- Date: 2026-05-10.
- Files changed: `package.json`, `package-lock.json`, `lib/local-db/tidy-db.ts`, `docs/ai/phase-logs/phase-1-dexie-foundation.md`.
- Validation run: `npm install dexie`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e:smoke`, `npm run test:ci`, `npm run build`, and a temporary `npm run dev` browser console check for `/` and `/login`.
- Manual validation: Public landing page and `/login` loaded through the dev server with zero browser console errors. No UI/server/query/DND behavior was intentionally changed, and the Dexie shell is not imported by app UI.
- Known risks: The DB shell currently exposes only a placeholder metadata store. Future checkpoints must add real local schema/types before any UI integration and must keep IndexedDB access browser-safe.
- Next checkpoint: `checkpoint/local-schema-types`.
