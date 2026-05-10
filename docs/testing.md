# Testing

## Strategy
Tidy uses two test layers:

- Unit tests for pure logic that should not need a browser, database, Supabase session, or Next server.
- Playwright E2E tests for route loading, core list/item/view flows, persistence checks, and regression coverage around optimistic behavior.

Keep tests focused on current behavior. Do not rewrite product behavior only to satisfy tests.

## Commands
- `npm run test`: run Vitest unit tests once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:ui`: run the Vitest UI.
- `npm run test:e2e`: run Playwright tests headless.
- `npm run test:e2e:headed`: run Playwright with a visible browser.
- `npm run test:e2e:debug`: run Playwright in debug mode.
- `npm run test:e2e:report`: open the last Playwright HTML report.
- `npm run test:all`: run unit tests, then E2E tests.

## Authenticated Dashboard E2E
Dashboard tests require an authenticated Supabase session.

By default, tests that need `/dashboard` skip with a clear reason unless `TIDY_E2E_STORAGE_STATE` points to a Playwright storage-state JSON file.

Example:

```text
TIDY_E2E_STORAGE_STATE=.playwright/auth/tidy-user.json npm run test:e2e
```

Create that file manually with Playwright codegen or a one-off setup script after logging in as a disposable test user. Do not commit storage-state files or real credentials.

## Playwright Traces
Playwright records traces on first retry and screenshots/videos on failure.

After a failed run:

```text
npm run test:e2e:report
```

Use the trace to inspect the exact selector, action, network state, and DOM snapshot before changing tests or app code.

## Data Naming
Generated E2E data must use a visible `e2e-` prefix plus a timestamp/random suffix. Helpers in `tests/e2e/utils/seed.ts` provide `uniqueTestName`.

Clean up test-created lists through the UI when possible. If cleanup fails, the visible prefix makes leftover data easy to identify.

## Data Test IDs
Use `data-testid` only for stable product surfaces where role/text selectors are not specific enough.

Allowed current test IDs:

- `app-shell`
- `create-list-button`
- `list-card`
- `list-title`
- `list-title-input`
- `create-item-input`
- `list-item`
- `list-item-title`
- `delete-list-button`
- `view-create-button`
- `view-card`
- `tag-selector`
- `save-view-button`

Do not add test IDs everywhere. Prefer role, label, placeholder, and visible text selectors when they are stable.

## Flake Rules
- Do not rely on arbitrary waits.
- Wait for visible UI state, persistence after reload, or specific assertions.
- Do not use random data without the `e2e-` prefix.
- Do not overuse `test.skip`; skip only the specific test that cannot run in the current environment.
- Document every skipped test with the exact missing fixture, selector, or capability.
- Do not delete failing tests to make a suite pass.

## Extending Tests
When adding a feature:

1. Add or update the smallest relevant unit or E2E test.
2. Run the targeted test first.
3. Run the full relevant suite.
4. Update this document if a new command, fixture, or selector convention is introduced.

## Current Gaps
- Dashboard E2E needs a committed auth setup strategy or a documented CI secret flow before it can run unskipped in CI.
- Drag/drop tests are skipped until deterministic dnd-kit pointer helpers are added.
- Tag-filtered view tests are skipped until deterministic tag creation and cleanup helpers exist.
- API ownership tests are still needed for protected tRPC procedures.
