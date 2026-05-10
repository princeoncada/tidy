import { expect, test } from "@playwright/test";

import { createList, createTag, createView, deleteList } from "./utils/app";
import { collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("create a view if the feature exists in the current app", async ({ page }) => {
  const listName = uniqueTestName("view-list");
  const tagName = uniqueTestName("view-tag");
  const viewName = uniqueTestName("view");

  await createList(page, listName);
  await createTag(page, listName, tagName);
  await createView(page, viewName, tagName);
  await deleteList(page, listName);
});

test("verify created view appears", async ({ page }) => {
  const listName = uniqueTestName("view-appears-list");
  const tagName = uniqueTestName("view-appears-tag");
  const viewName = uniqueTestName("view-appears");

  await createList(page, listName);
  await createTag(page, listName, tagName);
  await createView(page, viewName, tagName);
  await expect(page.getByTestId("view-card").filter({ hasText: viewName })).toBeVisible();
  await deleteList(page, listName);
});

test("verify view can be selected/opened", async ({ page }) => {
  const listName = uniqueTestName("view-select-list");
  const tagName = uniqueTestName("view-select-tag");
  const viewName = uniqueTestName("view-select");

  await createList(page, listName);
  await createTag(page, listName, tagName);
  await createView(page, viewName, tagName);
  await page.getByTestId("view-card").filter({ hasText: viewName }).getByRole("button", { name: viewName }).click();
  await expect(page.getByTestId("list-card").filter({ hasText: listName })).toBeVisible();
  await deleteList(page, listName);
});

test("basic tag-filtered view", async ({ page }) => {
  const matchingList = uniqueTestName("tag-view-match-list");
  const hiddenList = uniqueTestName("tag-view-hidden-list");
  const tagName = uniqueTestName("tag-view-tag");
  const viewName = uniqueTestName("tag-view");

  await createList(page, matchingList);
  await createList(page, hiddenList);
  await createTag(page, matchingList, tagName);
  await createView(page, viewName, tagName);
  await page.getByTestId("view-card").filter({ hasText: viewName }).getByRole("button", { name: viewName }).click();
  await expect(page.getByTestId("list-card").filter({ hasText: matchingList })).toBeVisible();
  await expect(page.getByTestId("list-card").filter({ hasText: hiddenList })).toHaveCount(0);
  await deleteList(page, matchingList);
});
