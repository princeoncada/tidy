# Testing Workflow For Codex

## Before Implementing A Feature
1. Read `docs/testing.md`.
2. Run `npm run test:ci` for typecheck, lint, unit tests, and default E2E.
3. Run `npm run test:e2e:auth:setup` when `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `DATABASE_URL` are available.
4. Run `npm run test:e2e:auth` after `tests/.auth/user.json` exists.
5. If authenticated dashboard E2E cannot run, document the missing credential or service. Do not describe `npm run test:e2e` as dashboard-auth coverage.
5. Identify existing coverage before adding new tests.

## After Implementing
1. Add or update the smallest relevant test.
2. Run the targeted test first.
3. Run the full relevant suite.
4. Document skipped tests with the exact reason.
5. Update `docs/testing.md` when commands, fixtures, selectors, or test data rules change.

## When A Test Fails
1. Do not guess.
2. Inspect the Playwright trace or Vitest assertion output.
3. Identify the exact selector, action, state, network, or data failure.
4. Fix the app if the product is wrong.
5. Fix the test if the selector, fixture, or assertion is wrong.
6. Rerun the targeted test.
7. Rerun the full relevant suite.

## Do Not
- Delete failing tests to pass.
- Overuse `test.skip`.
- Silently skip authenticated dashboard tests because credentials are missing.
- Rely on arbitrary timeouts.
- Use random data without a visible `e2e-` prefix.
- Change product behavior only to satisfy tests.
- Add broad `data-testid` coverage when a stable role, label, placeholder, or text selector works.
