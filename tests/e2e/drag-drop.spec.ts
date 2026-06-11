import { expect, test } from "./utils/fixtures";
import type { Page } from "@playwright/test";
import { config } from "dotenv";

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
import { dragByMouse, dragByMouseAndWaitForMutation } from "./utils/drag";
import { cleanupNamedList, collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";
import { testIds } from "./utils/test-ids";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

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
  const tagSearchInput = page.getByPlaceholder("Search or create tag...");
  if (await tagSearchInput.count() > 0) {
    await page.keyboard.press("Escape");
  }
  await expect(tagSearchInput).toHaveCount(0);
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

async function getLocalUserAndAllListsView(page: Page) {
  return page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tidy-local-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    try {
      if (!db.objectStoreNames.contains("views")) return null;

      const views = await new Promise<
        Array<{ clientId: string; userId: string; type: string }>
      >((resolve, reject) => {
        const transaction = db.transaction("views", "readonly");
        const request = transaction.objectStore("views").getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const allListsView = views.find((view) => view.type === "ALL_LISTS");

      return allListsView
        ? {
            userId: allListsView.userId,
            allListsViewId: allListsView.clientId,
          }
        : null;
    } finally {
      db.close();
    }
  }).then((handle) => handle.jsonValue());
}

async function getPendingMovementOperationCount(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tidy-local-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    try {
      const operations = await new Promise<
        Array<{
          entityType: string;
          operationType: string;
          status: string;
        }>
      >((resolve, reject) => {
        const transaction = db.transaction("outboxOperations", "readonly");
        const request = transaction.objectStore("outboxOperations").getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      return operations.filter(
        (operation) =>
          operation.status === "pending" &&
          ((operation.entityType === "listItem" &&
            ["move", "reorder"].includes(operation.operationType)) ||
            (operation.entityType === "viewList" &&
              operation.operationType === "reorder")),
      ).length;
    } finally {
      db.close();
    }
  });
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

test.describe("Dexie-first movement", () => {
  test.skip(
    () =>
      process.env.NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED !== "true",
    "Run this targeted proof with NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED=true.",
  );

  test("coalesces committed drops and preserves placement through view switch and reload", async ({
    page,
  }) => {
    const identity = await getLocalUserAndAllListsView(page);
    expect(identity).not.toBeNull();

    const { db } = await import("@/lib/db");
    const sourceListId = crypto.randomUUID();
    const targetListId = crypto.randomUUID();
    const movingItemId = crypto.randomUUID();
    const sourceAnchorId = crypto.randomUUID();
    const targetAnchorId = crypto.randomUUID();
    const customViewId = crypto.randomUUID();
    const sourceListName = uniqueTestName("dexie-move-source");
    const targetListName = uniqueTestName("dexie-move-target");
    const movingItemName = uniqueTestName("dexie-moving-item");
    const customViewName = uniqueTestName("dexie-move-view");
    const syncRequests: string[] = [];

    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/sync")
      ) {
        syncRequests.push(request.url());
      }
    });

    try {
      await db.$transaction(async (tx) => {
        await tx.view.updateMany({
          where: { userId: identity!.userId },
          data: { isDefault: false },
        });
        await tx.view.update({
          where: { id: identity!.allListsViewId },
          data: { isDefault: true },
        });
        await tx.view.create({
          data: {
            id: customViewId,
            name: customViewName,
            userId: identity!.userId,
            order: 1,
            type: "CUSTOM",
            isDefault: false,
            matchMode: "ALL",
          },
        });
        await tx.list.createMany({
          data: [
            {
              id: sourceListId,
              name: sourceListName,
              userId: identity!.userId,
            },
            {
              id: targetListId,
              name: targetListName,
              userId: identity!.userId,
            },
          ],
        });
        await tx.listItem.createMany({
          data: [
            {
              id: movingItemId,
              name: movingItemName,
              listId: sourceListId,
              order: 0,
            },
            {
              id: sourceAnchorId,
              name: uniqueTestName("dexie-source-anchor"),
              listId: sourceListId,
              order: 1,
            },
            {
              id: targetAnchorId,
              name: uniqueTestName("dexie-target-anchor"),
              listId: targetListId,
              order: 0,
            },
          ],
        });
        await tx.viewList.createMany({
          data: [
            {
              viewId: identity!.allListsViewId,
              listId: sourceListId,
              order: 0,
            },
            {
              viewId: identity!.allListsViewId,
              listId: targetListId,
              order: 1,
            },
            { viewId: customViewId, listId: sourceListId, order: 0 },
            { viewId: customViewId, listId: targetListId, order: 1 },
          ],
        });
      });

      await page.reload();
      await openAllLists(page);
      await expectItemInList(page, sourceListName, movingItemName);

      for (const targetListNameForDrop of [
        targetListName,
        sourceListName,
        targetListName,
      ]) {
        const movingItem = page
          .getByTestId(testIds.listItem)
          .filter({ hasText: movingItemName })
          .first();
        const targetCard = await getVisibleListCard(
          page,
          targetListNameForDrop,
        );

        await dragByMouse(
          page,
          movingItem.getByTestId(testIds.itemDragHandle),
          targetCard.getByTestId(testIds.listDropZone),
        );
        await page.waitForTimeout(400);
      }

      expect(syncRequests).toHaveLength(0);
      await expect
        .poll(() => getPendingMovementOperationCount(page))
        .toBe(3);
      await expectItemInList(page, targetListName, movingItemName);

      await openViewByName(page, customViewName);
      await expectItemNotInList(page, sourceListName, movingItemName);
      await expectItemInList(page, targetListName, movingItemName);

      await page.reload();
      await expect.poll(() => syncRequests.length).toBe(1);
      await expectItemNotInList(page, sourceListName, movingItemName);
      await expectItemInList(page, targetListName, movingItemName);
    } finally {
      await db.$transaction(async (tx) => {
        await tx.view.updateMany({
          where: { userId: identity!.userId },
          data: { isDefault: false },
        });
        await tx.view.updateMany({
          where: {
            id: identity!.allListsViewId,
            userId: identity!.userId,
          },
          data: { isDefault: true },
        });
        await tx.view.deleteMany({
          where: { id: customViewId, userId: identity!.userId },
        });
        await tx.list.deleteMany({
          where: {
            id: { in: [sourceListId, targetListId] },
            userId: identity!.userId,
          },
        });
      });
    }
  });
});
