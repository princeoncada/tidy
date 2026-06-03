import { expect, test, type Page } from "@playwright/test";

import {
  createTag,
  createItemInVisibleList,
  createList,
  createView,
  deleteView,
  openViewByName,
  openAllLists,
  waitForSuccessfulTrpcMutation,
} from "./utils/app";
import {
  expectItemInList,
  expectItemNotInList,
  expectListOrder,
  expectViewOrder,
  getVisibleListNames,
  getVisibleListCard,
  getVisibleViewCard,
  getVisibleViewNames,
} from "./utils/assertions";
import { dragByMouseAndWaitForMutation } from "./utils/drag";
import { cleanupNamedList, collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";
import { testIds } from "./utils/test-ids";

let consoleErrors: string[];

async function createPersistedList(page: Page, name: string) {
  const persisted = waitForSuccessfulTrpcMutation(page, "list.createList");

  await createList(page, name);
  await persisted;
}

async function createPersistedTag(page: Page, listName: string, tagName: string) {
  const persisted = waitForSuccessfulTrpcMutation(page, "tag.applyListTagChanges");

  await createTag(page, listName, tagName);
  await persisted;
}

async function attachExistingTag(page: Page, listName: string, tagName: string) {
  const card = await getVisibleListCard(page, listName);
  const persisted = waitForSuccessfulTrpcMutation(page, "tag.applyListTagChanges");

  await card.getByTestId(testIds.tagSelector).click();
  await page.getByPlaceholder("Search or create tag...").fill(tagName);
  await page.locator('[data-slot="command-item"]').filter({ hasText: tagName }).first().click();
  await persisted;
  await expect(card.getByText(tagName, { exact: true })).toBeVisible();
}

async function getOrderedVisibleNames(
  page: Page,
  expectedNames: string[],
  readVisibleNames: (page: Page) => Promise<string[]>
) {
  const visibleNames = await readVisibleNames(page);
  const orderedNames = visibleNames.reduce<string[]>((ordered, visibleName) => {
    const matchingName = expectedNames.find(
      (expectedName) =>
        visibleName.includes(expectedName) && !ordered.includes(expectedName)
    );

    return matchingName ? [...ordered, matchingName] : ordered;
  }, []);

  expect(orderedNames).toHaveLength(expectedNames.length);

  return orderedNames;
}

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
  await openAllLists(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("reorder custom view cards persists after reload", async ({ page }) => {
  const listName = uniqueTestName("view-card-list");
  const firstTag = uniqueTestName("view-card-tag-first");
  const secondTag = uniqueTestName("view-card-tag-second");
  const firstView = uniqueTestName("view-card-first");
  const secondView = uniqueTestName("view-card-second");

  await createPersistedList(page, listName);
  await createPersistedTag(page, listName, firstTag);
  await createPersistedTag(page, listName, secondTag);
  await createView(page, firstView, firstTag);
  await createView(page, secondView, secondTag);

  const initialOrder = await getOrderedVisibleNames(
    page,
    [firstView, secondView],
    getVisibleViewNames
  );
  await expectViewOrder(page, initialOrder);

  const sourceViewCard = await getVisibleViewCard(page, initialOrder[0]);
  const targetViewCard = await getVisibleViewCard(page, initialOrder[1]);
  const swappedOrder = [initialOrder[1], initialOrder[0]];

  await dragByMouseAndWaitForMutation(
    page,
    sourceViewCard.getByTestId(testIds.viewDragHandle),
    targetViewCard.getByTestId(testIds.viewDragHandle),
    "view.reorderViews"
  );

  await expectViewOrder(page, swappedOrder);
  await page.reload();
  await expectViewOrder(page, swappedOrder);
  await deleteView(page, firstView);
  await deleteView(page, secondView);
  await cleanupNamedList(page, listName);
});

test("reorder lists inside a custom view persists after reload", async ({ page }) => {
  const firstList = uniqueTestName("view-list-first");
  const secondList = uniqueTestName("view-list-second");
  const sharedTag = uniqueTestName("view-list-tag");
  const customView = uniqueTestName("view-list-custom");

  await createPersistedList(page, firstList);
  await createPersistedList(page, secondList);
  await createPersistedTag(page, firstList, sharedTag);
  await attachExistingTag(page, secondList, sharedTag);
  await createView(page, customView, sharedTag);
  await openViewByName(page, customView);
  await expect(await getVisibleListCard(page, firstList)).toBeVisible();
  await expect(await getVisibleListCard(page, secondList)).toBeVisible();

  const initialOrder = await getOrderedVisibleNames(
    page,
    [firstList, secondList],
    getVisibleListNames
  );
  await expectListOrder(page, initialOrder);

  const sourceListCard = await getVisibleListCard(page, initialOrder[0]);
  const targetListCard = await getVisibleListCard(page, initialOrder[1]);
  const swappedOrder = [initialOrder[1], initialOrder[0]];

  await dragByMouseAndWaitForMutation(
    page,
    sourceListCard.getByTestId(testIds.listDragHandle),
    targetListCard.getByTestId(testIds.listDragHandle),
    "view.reorderViewLists"
  );

  await expectListOrder(page, swappedOrder);
  await page.reload();
  await openViewByName(page, customView);
  await expectListOrder(page, swappedOrder);
  await deleteView(page, customView);
  await cleanupNamedList(page, firstList);
  await cleanupNamedList(page, secondList);
});

test("reorder lists if drag/drop is currently implemented", async ({ page }) => {
  const first = uniqueTestName("drag-list-first");
  const second = uniqueTestName("drag-list-second");
  await createPersistedList(page, first);
  await createPersistedList(page, second);

  const firstCard = await getVisibleListCard(page, first);
  const secondCard = await getVisibleListCard(page, second);
  await expectListOrder(page, [second, first]);

  await dragByMouseAndWaitForMutation(
    page,
    firstCard.getByTestId(testIds.listDragHandle),
    secondCard.getByTestId(testIds.listDragHandle),
    "view.reorderViewLists"
  );

  await expectListOrder(page, [first, second]);
  await page.reload();
  await expectListOrder(page, [first, second]);
  await cleanupNamedList(page, first);
  await cleanupNamedList(page, second);
});

test("move item between lists if implemented", async ({ page }) => {
  const sourceList = uniqueTestName("move-source");
  const targetList = uniqueTestName("move-target");
  const itemName = uniqueTestName("move-item");
  await createPersistedList(page, sourceList);
  await createPersistedList(page, targetList);
  await createItemInVisibleList(page, sourceList, itemName, { waitForPersistence: true });

  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName }).first();
  const targetCard = await getVisibleListCard(page, targetList);
  await dragByMouseAndWaitForMutation(
    page,
    item.getByTestId(testIds.itemDragHandle),
    targetCard.getByTestId(testIds.listDropZone),
    "listItem.reorderListItems"
  );

  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await page.reload();
  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await cleanupNamedList(page, sourceList);
  await cleanupNamedList(page, targetList);
});

test("move item into empty list if implemented", async ({ page }) => {
  const sourceList = uniqueTestName("empty-move-source");
  const targetList = uniqueTestName("empty-move-target");
  const itemName = uniqueTestName("empty-move-item");
  await createPersistedList(page, sourceList);
  await createPersistedList(page, targetList);
  await createItemInVisibleList(page, sourceList, itemName, { waitForPersistence: true });

  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName }).first();
  const targetCard = await getVisibleListCard(page, targetList);
  await dragByMouseAndWaitForMutation(
    page,
    item.getByTestId(testIds.itemDragHandle),
    targetCard.getByTestId(testIds.listDropZone),
    "listItem.reorderListItems"
  );

  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await page.reload();
  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await cleanupNamedList(page, sourceList);
  await cleanupNamedList(page, targetList);
});
