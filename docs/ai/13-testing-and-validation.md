# Testing And Validation

## Purpose
Document available validation commands and high-value manual regression checks.

## Current Implementation
There is no dedicated automated test suite in `package.json`. Available scripts:

- `npm run lint`: ESLint with Next core web vitals and TypeScript config.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run test`: Vitest unit tests.
- `npm run test:e2e`: Playwright E2E tests.
- `npm run test:all`: Vitest followed by Playwright.
- `npm run build`: `prisma generate && next build`.
- `npm run dev`: local Next dev server.
- `npm start`: production server after build.

Dashboard E2E tests require `TIDY_E2E_STORAGE_STATE` to point to an authenticated Playwright storage-state file. Without it, dashboard tests skip and public smoke tests still run.

See `docs/testing.md` and `ai-docs/testing-workflow.md` before changing test infrastructure.

## Important Files
- `package.json`: scripts and dependency versions.
- `eslint.config.mjs`: lint config.
- `tsconfig.json`: TypeScript strict config.
- `prisma.config.ts`: Prisma config.
- `prisma/schema.prisma`: generate/build dependency.
- `trpc/query-client.ts`: query defaults that affect runtime validation.
- `playwright.config.ts`: E2E config and dev server startup.
- `vitest.config.ts`: unit test config.
- `tests/e2e/*`: Playwright tests and helpers.
- `tests/unit/*`: Vitest unit tests.

## Data Flow
Suggested validation by change type:

- Docs-only: no build required unless links/reference names are uncertain.
- Pure helper/cache logic: `npm run test`.
- Browser/dashboard behavior: targeted `npm run test:e2e -- <spec>` first, then `npm run test:e2e`.
- Type-only or router/component change: `npm run typecheck` and `npm run lint`.
- Prisma/schema change: `prisma generate`, typecheck, migration review, build.
- Next route/layout/config change: read local Next docs if available, then typecheck/build.
- Dashboard interaction change: run app and manually exercise cache/sync flows.

Manual dashboard checks:

- Login, logout, and confirm cache clears after logout.
- Create list in All Lists.
- Create list inside a custom view and verify required tags are inherited.
- Add item immediately after creating a list before the server response settles.
- Rename list and item, then refresh.
- Complete/uncomplete item, then refresh.
- Delete list and item, including rollback behavior if API fails.
- Drag lists in All Lists and custom view.
- Drag item within a list and across lists.
- Create, rename, update, delete, select, and reorder custom views.
- Create tag, attach/detach tags quickly, delete tag, and verify affected custom views.
- Fast-switch views and verify older fetches do not repaint the dashboard.

## Invariants
- Validation should match risk. Small docs changes do not need a full build.
- Any server/API ownership fix should include a manual or automated unauthorized-access check if possible.
- Any cache/sync change should include at least one refresh-after-save check.
- Any drag/drop change should test canceled drag and final drop.
- Any mobile layout change should check at least one narrow viewport.

## Known Risks
- No Playwright, Vitest, or integration tests are configured.
- Database-backed validation requires valid `DATABASE_URL` and Supabase env vars.
- Build runs Prisma generate, so missing env/setup can block validation in fresh environments.
- Manual testing is currently the only way to validate most optimistic race cases.

## What Codex Should Read Before Editing
- This file before finishing any code change.
- Relevant feature doc for manual scenario list.
- `package.json` before invoking scripts.

## What Codex Must Update After Editing
- Add new validation commands or manual test cases here.
- Update `backlog.md` testing section with missing automated coverage.
- Mention in final PR notes which validations ran and which could not run.
