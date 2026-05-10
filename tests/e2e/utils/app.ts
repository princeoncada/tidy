import { expect, type Page } from "@playwright/test";

import { testIds } from "./test-ids";

export async function createList(page: Page, name: string) {
  await page.getByTestId(testIds.createListButton).first().click();
  await page.getByPlaceholder("Enter your list name...").fill(name);
  await page.getByRole("button", { name: "Create List" }).click();
  await expect(page.getByTestId(testIds.listCard).filter({ hasText: name })).toBeVisible();
}

export async function renameList(page: Page, oldName: string, newName: string) {
  const card = page.getByTestId(testIds.listCard).filter({ hasText: oldName }).first();
  await card.getByTestId(testIds.listTitle).click();
  await card.getByTestId(testIds.listTitleInput).fill(newName);
  await card.getByTestId(testIds.listTitleInput).press("Enter");
  await expect(page.getByTestId(testIds.listCard).filter({ hasText: newName })).toBeVisible();
}

export async function deleteList(page: Page, name: string) {
  const card = page.getByTestId(testIds.listCard).filter({ hasText: name }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /list options/i }).click();
  await page.getByTestId(testIds.deleteListButton).click();
  await expect(card).toBeHidden({ timeout: 10_000 });
}

export async function createItem(page: Page, listName: string, itemName: string) {
  const card = page.getByTestId(testIds.listCard).filter({ hasText: listName }).first();
  await card.getByRole("button", { name: /list options/i }).click();
  await page.getByRole("menuitem", { name: "Add Item" }).click();
  await card.getByTestId(testIds.createItemInput).fill(itemName);
  await card.getByTestId(testIds.createItemInput).press("Enter");
  await expect(card.getByTestId(testIds.listItem).filter({ hasText: itemName })).toBeVisible();
}

export async function renameItem(page: Page, oldName: string, newName: string) {
  const item = page.getByTestId(testIds.listItem).filter({ hasText: oldName }).first();
  await item.getByTestId(testIds.listItemTitle).click();
  await item.getByTestId(testIds.listTitleInput).fill(newName);
  await item.getByTestId(testIds.listTitleInput).press("Enter");
  await expect(page.getByTestId(testIds.listItem).filter({ hasText: newName })).toBeVisible();
}

export async function deleteItem(page: Page, itemName: string) {
  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName }).first();
  await expect(item).toBeVisible();
  await item.getByRole("button").last().click();
  await expect(item).toBeHidden({ timeout: 10_000 });
}

export async function createTag(page: Page, listName: string, tagName: string) {
  const card = page.getByTestId(testIds.listCard).filter({ hasText: listName }).first();
  await card.getByTestId(testIds.tagSelector).click();
  await page.getByPlaceholder("Search or create tag...").fill(tagName);
  await page.getByText(`Create "${tagName}"`).click();
  await expect(card.getByText(tagName, { exact: true })).toBeVisible();
}

export async function createView(page: Page, viewName: string, tagName: string) {
  await page.getByTestId(testIds.viewCreateButton).first().click();
  await page.getByLabel("Name").fill(viewName);
  await page.getByText(tagName, { exact: true }).click();
  await page.getByTestId(testIds.saveViewButton).click();
  await expect(page.getByTestId(testIds.viewCard).filter({ hasText: viewName })).toBeVisible();
}
