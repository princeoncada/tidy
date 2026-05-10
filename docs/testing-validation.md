# Testing Validation

## Commands
- `npm run typecheck`: TypeScript validation.
- `npm run lint`: ESLint validation.
- `npm run test`: Vitest unit tests.
- `npm run test:e2e`: non-authenticated Playwright tests only.
- `npm run test:e2e:smoke`: public smoke E2E only.
- `npm run test:e2e:auth:setup`: login through `/login` and create local storage state at `tests/.auth/user.json`.
- `npm run test:e2e:auth`: authenticated dashboard E2E using existing `tests/.auth/user.json`.
- `npm run test:ci`: typecheck, lint, unit tests, and non-authenticated E2E.

## Coverage
- Unit tests cover pure dashboard cache projection and view matching logic.
- Non-authenticated E2E covers public app load, login page load, initial console health, and unauthenticated dashboard redirect behavior.
- Authenticated E2E covers list create/rename/delete/persistence, item create/rename/delete/persistence, rapid create regression checks, basic view/tag filtering, and drag/drop persistence.

## Authenticated Setup
Normal validation:

```text
npm run test:ci
```

Normal E2E without credentials:

```text
npm run test:e2e
```

Authenticated dashboard E2E is opt-in and not part of default CI yet. To run it locally:

```text
copy .env.example .env.local
```

Set local placeholder values to a real test account only on your machine:

```text
E2E_TEST_EMAIL=your-test-user@example.com
E2E_TEST_PASSWORD=your-test-password
```

Then generate storage state and run authenticated tests:

```text
npm run test:e2e:auth:setup
npm run test:e2e:auth
```

`tests/.auth/user.json` is local-only and ignored by git. Do not commit it.

## Manual Checklist
- Login and confirm the dashboard loads.
- Create, rename, delete, and refresh a list.
- Create, rename, delete, and refresh an item.
- Create a tag, create a view from that tag, and confirm unmatched lists are hidden.
- Drag lists and items, then refresh to confirm order/move persisted.
- Check the Playwright report or trace for selector, console, or network failures before changing tests.

## Known Gaps
- Authenticated dashboard E2E requires a real Supabase test user and database; it is not part of `npm run test:e2e` or `npm run test:ci`.
- API ownership/security tests are not implemented yet.
- Drag/drop uses a mouse movement helper because dnd-kit is not reliably exercised by Playwright `locator.dragTo`.
- View cleanup is still minimal; test data uses an `e2e-` prefix so leftovers are easy to identify.
