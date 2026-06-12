import { config } from "dotenv";
import type { Page, Request } from "@playwright/test";

import { expect, test } from "./utils/fixtures";
import { openAllLists } from "./utils/app";
import {
  firstVisible,
  getVisibleListCard,
  getVisibleViewCard,
} from "./utils/assertions";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  gotoDashboard,
  uniqueTestName,
} from "./utils/seed";
import { testIds } from "./utils/test-ids";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

let consoleErrors: string[];

async function getLocalUserAndAllListsView(
  page: Page,
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const identity = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tidy-local-db");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        if (!db.objectStoreNames.contains("views")) {
          return null;
        }

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
    });

    if (identity) {
      return identity;
    }

    await page.waitForTimeout(250);
  }

  return null;
}

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
  await openAllLists(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test.describe("Dexie-first tags and views", () => {
  test.skip(
    () =>
      process.env.NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED !== "true",
    "Run this targeted proof with NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED=true.",
  );

  test("persists tag attachment and custom-view creation without direct tRPC writes", async ({
    page,
  }) => {
    const identity = await getLocalUserAndAllListsView(page);
    expect(identity).not.toBeNull();

    const { db } = await import("@/lib/db");
    const listId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    const listName = uniqueTestName("dexie-tag-view-list");
    const tagName = uniqueTestName("dexie-tag-view-tag");
    const viewName = uniqueTestName("dexie-tag-view");
    const directMutationRequests: string[] = [];

    const directMutationProcedures = [
      "tag.create",
      "tag.update",
      "tag.delete",
      "tag.applyListTagChanges",
      "view.create",
      "view.rename",
      "view.updateFilter",
      "view.delete",
      "view.saveSelectedView",
    ];
    const trackDirectMutation = (request: Request) => {
      const url = request.url();

      if (
        request.method() === "POST" &&
        directMutationProcedures.some((procedure) =>
          url.includes(`/api/trpc/${procedure}`),
        )
      ) {
        directMutationRequests.push(url);
      }
    };

    page.on("request", trackDirectMutation);

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
        await tx.list.create({
          data: {
            id: listId,
            name: listName,
            userId: identity!.userId,
          },
        });
        await tx.tag.create({
          data: {
            id: tagId,
            name: tagName,
            color: "gray",
            userId: identity!.userId,
          },
        });
        await tx.viewList.create({
          data: {
            viewId: identity!.allListsViewId,
            listId,
            order: 0,
          },
        });
      });

      await page.reload();
      await openAllLists(page);

      const listCard = await getVisibleListCard(page, listName);
      await listCard.getByTestId(testIds.tagSelector).click();
      await page.getByPlaceholder("Search or create tag...").fill(tagName);
      await page
        .locator('[data-slot="command-group"]')
        .filter({ hasText: "Existing tags" })
        .locator('[data-slot="command-item"]')
        .filter({ hasText: tagName })
        .first()
        .click();
      await expect(listCard.getByText(tagName, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");

      const createViewButton = await firstVisible(
        page.getByTestId(testIds.viewCreateButton),
      );
      await createViewButton.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(viewName);
      await dialog.getByRole("button", { name: new RegExp(`^${tagName}\\b`) }).click();
      await dialog.getByTestId(testIds.saveViewButton).click();
      await expect(await getVisibleViewCard(page, viewName)).toBeVisible();

      await page.waitForTimeout(300);
      expect(directMutationRequests).toEqual([]);

      const localProof = await page.evaluate(
        async ({ expectedListId, expectedTagId, expectedViewName }) => {
          const localDb = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("tidy-local-db");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });

          try {
            const readAll = <T,>(storeName: string) =>
              new Promise<T[]>((resolve, reject) => {
                const transaction = localDb.transaction(storeName, "readonly");
                const request = transaction.objectStore(storeName).getAll();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
              });
            const [listTags, views, viewTags, operations] = await Promise.all([
              readAll<{
                listClientId: string;
                tagClientId: string;
                deletedAt: string | null;
              }>("listTags"),
              readAll<{
                clientId: string;
                name: string;
                deletedAt: string | null;
              }>("views"),
              readAll<{
                viewClientId: string;
                tagClientId: string;
                deletedAt: string | null;
              }>("viewTags"),
              readAll<{
                entityType: string;
                entityClientId: string;
                operationType: string;
                status: string;
              }>("outboxOperations"),
            ]);
            const createdView = views.find(
              (view) =>
                view.name === expectedViewName && view.deletedAt === null,
            );

            return {
              viewId: createdView?.clientId ?? null,
              listTagPersisted: listTags.some(
                (listTag) =>
                  listTag.listClientId === expectedListId &&
                  listTag.tagClientId === expectedTagId &&
                  listTag.deletedAt === null,
              ),
              viewTagPersisted: Boolean(
                createdView &&
                  viewTags.some(
                    (viewTag) =>
                      viewTag.viewClientId === createdView.clientId &&
                      viewTag.tagClientId === expectedTagId &&
                      viewTag.deletedAt === null,
                  ),
              ),
              attachQueued: operations.some(
                (operation) =>
                  operation.entityType === "listTag" &&
                  operation.entityClientId ===
                    `${expectedListId}:${expectedTagId}` &&
                  operation.operationType === "attach" &&
                  operation.status === "pending",
              ),
              viewCreateQueued: Boolean(
                createdView &&
                  operations.some(
                    (operation) =>
                      operation.entityType === "view" &&
                      operation.entityClientId === createdView.clientId &&
                      operation.operationType === "create" &&
                      operation.status === "pending",
                  ),
              ),
            };
          } finally {
            localDb.close();
          }
        },
        {
          expectedListId: listId,
          expectedTagId: tagId,
          expectedViewName: viewName,
        },
      );

      expect(localProof).toMatchObject({
        listTagPersisted: true,
        viewTagPersisted: true,
        attachQueued: true,
        viewCreateQueued: true,
      });
    } finally {
      page.off("request", trackDirectMutation);

      await page.evaluate(
        async ({ expectedListId, expectedTagId, expectedViewName }) => {
          const localDb = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("tidy-local-db");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });

          try {
            const readAll = <T,>(storeName: string) =>
              new Promise<T[]>((resolve, reject) => {
                const transaction = localDb.transaction(storeName, "readonly");
                const request = transaction.objectStore(storeName).getAll();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
              });

            const [views, operations] = await Promise.all([
              readAll<{ clientId: string; name: string }>("views"),
              readAll<{
                operationId: string;
                entityClientId: string;
              }>("outboxOperations"),
            ]);
            const createdView = views.find(
              (view) => view.name === expectedViewName,
            );
            const transaction = localDb.transaction(
              [
                "lists",
                "tags",
                "listTags",
                "views",
                "viewTags",
                "outboxOperations",
              ],
              "readwrite",
            );
            const viewsStore = transaction.objectStore("views");
            const viewTagsStore = transaction.objectStore("viewTags");
            const operationsStore = transaction.objectStore("outboxOperations");

            transaction.objectStore("lists").delete(expectedListId);
            transaction.objectStore("tags").delete(expectedTagId);
            transaction
              .objectStore("listTags")
              .delete(`${expectedListId}:${expectedTagId}`);

            if (createdView) {
              viewsStore.delete(createdView.clientId);
              viewTagsStore.delete(
                `${createdView.clientId}:${expectedTagId}`,
              );
            }

            for (const operation of operations) {
              if (
                operation.entityClientId ===
                  `${expectedListId}:${expectedTagId}` ||
                operation.entityClientId === createdView?.clientId
              ) {
                operationsStore.delete(operation.operationId);
              }
            }

            await new Promise<void>((resolve, reject) => {
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error);
              transaction.onabort = () => reject(transaction.error);
            });
          } finally {
            localDb.close();
          }
        },
        {
          expectedListId: listId,
          expectedTagId: tagId,
          expectedViewName: viewName,
        },
      );

      await db.$transaction(async (tx) => {
        await tx.view.deleteMany({
          where: { name: viewName, userId: identity!.userId },
        });
        await tx.list.deleteMany({
          where: { id: listId, userId: identity!.userId },
        });
        await tx.tag.deleteMany({
          where: { id: tagId, userId: identity!.userId },
        });
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
      });
    }
  });
});
