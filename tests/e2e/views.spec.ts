import { expect, test } from "@playwright/test";

import {
  createList,
  createTag,
  createView,
  deleteList,
  openAllLists,
  openViewByName,
  removeTagFromList,
} from "./utils/app";
import { expectListNotVisible, expectListVisible } from "./utils/assertions";
import { collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("tagged All Lists entries appear in custom views after reload", async ({ page }) => {
  const listName = uniqueTestName("all-lists-view-list");
  const tagName = uniqueTestName("all-lists-view-tag");
  const viewName = uniqueTestName("all-lists-view");

  await createList(page, listName);
  await createTag(page, listName, tagName);
  await createView(page, viewName, tagName);
  await openViewByName(page, viewName);
  await expectListVisible(page, listName);
  await page.reload();
  await expectListVisible(page, listName);
  await openAllLists(page);
  await deleteList(page, listName);
});

test("lists created inside a custom view remain visible in that view after reload", async ({ page }) => {
  const seedListName = uniqueTestName("custom-create-seed-list");
  const createdInViewListName = uniqueTestName("custom-create-list");
  const tagName = uniqueTestName("custom-create-tag");
  const viewName = uniqueTestName("custom-create-view");

  await createList(page, seedListName);
  await createTag(page, seedListName, tagName);
  await createView(page, viewName, tagName);
  await openViewByName(page, viewName);
  await createList(page, createdInViewListName);
  const createdListCard = page
    .getByTestId("list-card")
    .filter({ hasText: createdInViewListName });
  await expect(createdListCard.getByText(tagName, { exact: true })).toBeVisible();
  await page.reload();
  await expectListVisible(page, createdInViewListName);
  await openAllLists(page);
  await deleteList(page, createdInViewListName);
  await deleteList(page, seedListName);
});

test("custom views show tagged lists without hiding All Lists entries", async ({ page }) => {
  const matchingList = uniqueTestName("tagged-only-match-list");
  const hiddenList = uniqueTestName("tagged-only-hidden-list");
  const tagName = uniqueTestName("tagged-only-tag");
  const viewName = uniqueTestName("tagged-only-view");

  await createList(page, matchingList);
  await createList(page, hiddenList);
  await createTag(page, matchingList, tagName);
  await createView(page, viewName, tagName);
  await openViewByName(page, viewName);
  await expectListVisible(page, matchingList);
  await expectListNotVisible(page, hiddenList);
  await openAllLists(page);
  await expectListVisible(page, matchingList);
  await expectListVisible(page, hiddenList);
  await deleteList(page, matchingList);
  await deleteList(page, hiddenList);
});

test("removed matching tags keep lists out of custom views after reload", async ({ page }) => {
  const listName = uniqueTestName("removed-tag-list");
  const tagName = uniqueTestName("removed-tag");
  const viewName = uniqueTestName("removed-tag-view");

  await createList(page, listName);
  await createTag(page, listName, tagName);
  await createView(page, viewName, tagName);
  await openViewByName(page, viewName);
  await expectListVisible(page, listName);
  await removeTagFromList(page, listName, tagName);
  await expectListNotVisible(page, listName);
  await page.reload();
  await expectListNotVisible(page, listName);
  await openAllLists(page);
  await expectListVisible(page, listName);
  await deleteList(page, listName);
});

test("latest selected view wins after fast switching", async ({ page }) => {
  const matchingList = uniqueTestName("fast-switch-match-list");
  const hiddenList = uniqueTestName("fast-switch-hidden-list");
  const tagName = uniqueTestName("fast-switch-tag");
  const viewName = uniqueTestName("fast-switch-view");

  await createList(page, matchingList);
  await createList(page, hiddenList);
  await createTag(page, matchingList, tagName);
  await createView(page, viewName, tagName);

  for (let i = 0; i < 3; i += 1) {
    await openAllLists(page);
    await openViewByName(page, viewName);
  }

  await expect(page.getByTestId("list-card").filter({ hasText: matchingList })).toBeVisible();
  await expectListNotVisible(page, hiddenList);
  await page.waitForTimeout(750);
  await expectListVisible(page, matchingList);
  await expectListNotVisible(page, hiddenList);
  await openAllLists(page);
  await deleteList(page, matchingList);
  await deleteList(page, hiddenList);
});
