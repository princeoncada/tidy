import { expect, type Page, test } from "@playwright/test";

export const authStorageState = process.env.TIDY_E2E_STORAGE_STATE;
export const hasAuthStorageState = Boolean(authStorageState);

export function uniqueTestName(prefix: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${prefix}-${suffix}`;
}

export async function gotoDashboardOrSkip(page: Page) {
  if (!hasAuthStorageState) {
    test.skip(true, "Dashboard E2E requires TIDY_E2E_STORAGE_STATE with an authenticated Playwright storage state.");
  }

  await page.goto("/dashboard");
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function cleanupNamedList(page: Page, name: string) {
  const card = page.getByTestId("list-card").filter({ hasText: name }).first();

  if (await card.count() === 0) return;

  await card.getByRole("button", { name: /list options/i }).click();
  await page.getByTestId("delete-list-button").click();
  await expect(card).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
}
