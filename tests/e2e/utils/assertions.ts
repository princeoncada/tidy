import { expect, type Page } from "@playwright/test";

export async function expectListVisible(page: Page, name: string) {
  await expect(page.getByTestId("list-card").filter({ hasText: name })).toBeVisible();
}

export async function expectListNotVisible(page: Page, name: string) {
  await expect(page.getByTestId("list-card").filter({ hasText: name })).toHaveCount(0);
}

export async function expectItemVisible(page: Page, itemName: string) {
  await expect(page.getByTestId("list-item").filter({ hasText: itemName })).toBeVisible();
}

export async function expectItemNotVisible(page: Page, itemName: string) {
  await expect(page.getByTestId("list-item").filter({ hasText: itemName })).toHaveCount(0);
}

export async function reloadAndExpectPersisted(page: Page, text: string) {
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function reloadAndExpectMissing(page: Page, text: string) {
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
}

export async function expectNoDuplicateText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
}

export async function getVisibleListNames(page: Page) {
  return await page.getByTestId("list-title").evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean)
  );
}

export async function expectListOrder(page: Page, orderedNames: string[]) {
  await expect
    .poll(async () => {
      const names = await getVisibleListNames(page);
      const indexes = orderedNames.map((name) => names.indexOf(name));
      return indexes.every((index) => index >= 0) &&
        indexes.every((index, position) => position === 0 || indexes[position - 1] < index);
    })
    .toBe(true);
}

export async function expectItemInList(page: Page, listName: string, itemName: string) {
  const card = page.getByTestId("list-card").filter({ hasText: listName }).first();
  await expect(card.getByTestId("list-item").filter({ hasText: itemName })).toBeVisible();
}

export async function expectItemNotInList(page: Page, listName: string, itemName: string) {
  const card = page.getByTestId("list-card").filter({ hasText: listName }).first();
  await expect(card.getByTestId("list-item").filter({ hasText: itemName })).toHaveCount(0);
}
