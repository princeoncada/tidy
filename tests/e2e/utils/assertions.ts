import { expect, type Page } from "@playwright/test";

export async function expectListVisible(page: Page, name: string) {
  await expect(page.getByTestId("list-card").filter({ hasText: name })).toBeVisible();
}

export async function expectItemVisible(page: Page, itemName: string) {
  await expect(page.getByTestId("list-item").filter({ hasText: itemName })).toBeVisible();
}

export async function reloadAndExpectPersisted(page: Page, text: string) {
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function expectNoDuplicateText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
}
