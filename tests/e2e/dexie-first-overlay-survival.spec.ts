import { config } from "dotenv";
import type { Page, Request, Route } from "@playwright/test";

import { expect, test } from "./utils/fixtures";
import { openAllLists } from "./utils/app";
import {
  firstVisible,
  getVisibleListCard,
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

  try {
    const diag = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tidy-local-db");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        const readAll = <T,>(storeName: string) =>
          new Promise<T[]>((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
        const [lists, operations] = await Promise.all([
          readAll<{
            clientId: string;
            name: string;
            syncStatus: string;
          }>("lists"),
          readAll<{
            entityType: string;
            operationType: string;
            entityClientId: string;
            status: string;
          }>("outboxOperations"),
        ]);

        return {
          lists: lists.map(({ clientId, name, syncStatus }) => ({
            clientId,
            name,
            syncStatus,
          })),
          operations: operations.map(
            ({ entityType, operationType, entityClientId, status }) => ({
              entityType,
              operationType,
              entityClientId,
              status,
            }),
          ),
        };
      } finally {
        db.close();
      }
    });

    console.log("OVERLAY_DIAG " + JSON.stringify(diag));
  } catch (error) {
    console.log("OVERLAY_DIAG_ERROR " + String(error));
  }

  return null;
}

async function waitForPendingListAndTagAttach(
  page: Page,
  listName: string,
  tagId: string,
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const proof = await page.evaluate(
      async ({ expectedListName, expectedTagId }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("tidy-local-db");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        try {
          const readAll = <T,>(storeName: string) =>
            new Promise<T[]>((resolve, reject) => {
              const transaction = db.transaction(storeName, "readonly");
              const request = transaction.objectStore(storeName).getAll();
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve(request.result);
            });
          const [lists, operations] = await Promise.all([
            readAll<{ clientId: string; name: string }>("lists"),
            readAll<{
              entityType: string;
              entityClientId: string;
              operationType: string;
              status: string;
              payload?: { name?: string };
            }>("outboxOperations"),
          ]);
          const localList = lists.find((list) => list.name === expectedListName);

          if (!localList) return null;

          const activeStatuses = new Set(["pending", "syncing", "failed"]);
          return {
            listId: localList.clientId,
            listCreateQueued: operations.some(
              (operation) =>
                operation.entityType === "list" &&
                operation.entityClientId === localList.clientId &&
                operation.operationType === "create" &&
                activeStatuses.has(operation.status),
            ),
            tagAttachQueued: operations.some(
              (operation) =>
                operation.entityType === "listTag" &&
                operation.entityClientId ===
                  `${localList.clientId}:${expectedTagId}` &&
                operation.operationType === "attach" &&
                activeStatuses.has(operation.status),
            ),
          };
        } finally {
          db.close();
        }
      },
      { expectedListName: listName, expectedTagId: tagId },
    );

    if (proof?.listCreateQueued && proof.tagAttachQueued) {
      return proof;
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

test.describe("Dexie-first reconcile overlay", () => {
  test.skip(
    () =>
      process.env.NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED !== "true",
    "Run this targeted proof with NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED=true.",
  );

  test("keeps optimistic list creation and tag attachment visible across server hydration", async ({
    page,
  }) => {
    const identity = await getLocalUserAndAllListsView(page);
    expect(identity).not.toBeNull();

    const { db } = await import("@/lib/db");
    const serverListId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    const serverListName = uniqueTestName("overlay-server-list");
    const localListName = uniqueTestName("overlay-local-list");
    const tagName = uniqueTestName("overlay-tag");
    const directMutationRequests: string[] = [];
    let localListId: string | null = null;

    const directMutationProcedures = [
      "list.createList",
      "tag.create",
      "tag.applyListTagChanges",
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
    const blockSync = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          results: [],
          error: "overlay proof keeps work pending",
        }),
      });

    page.on("request", trackDirectMutation);
    await page.route("**/api/sync", blockSync);

    try {
      await db.$transaction(async (tx) => {
        await tx.list.create({
          data: {
            id: serverListId,
            name: serverListName,
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
        await tx.listTag.create({
          data: { listId: serverListId, tagId },
        });
        await tx.viewList.create({
          data: {
            viewId: identity!.allListsViewId,
            listId: serverListId,
            order: 0,
          },
        });
      });

      await page.reload();
      await openAllLists(page);
      await expect(
        (await getVisibleListCard(page, serverListName)).getByText(tagName, {
          exact: true,
        }),
      ).toBeVisible();

      const createListButton = await firstVisible(
        page.getByTestId(testIds.createListButton),
      );
      await createListButton.click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByPlaceholder("Enter your list name...")
        .fill(localListName);
      await dialog.getByRole("button", { name: "Create List" }).click();

      const localListCard = await getVisibleListCard(page, localListName);
      await expect(localListCard).toBeVisible();
      await localListCard.getByTestId(testIds.tagSelector).click();
      await page.getByPlaceholder("Search or create tag...").fill(tagName);
      await page
        .locator('[data-slot="command-group"]')
        .filter({ hasText: "Existing tags" })
        .locator('[data-slot="command-item"]')
        .filter({ hasText: tagName })
        .first()
        .click();
      await expect(
        localListCard.getByText(tagName, { exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");

      const localProof = await waitForPendingListAndTagAttach(
        page,
        localListName,
        tagId,
      );
      expect(localProof).not.toBeNull();
      localListId = localProof!.listId;
      expect(directMutationRequests).toEqual([]);

      await page.reload();
      await openAllLists(page);

      const rehydratedListCard = await getVisibleListCard(page, localListName);
      await expect(rehydratedListCard).toBeVisible();
      await expect(
        rehydratedListCard.getByText(tagName, { exact: true }),
      ).toBeVisible();
      expect(directMutationRequests).toEqual([]);
    } finally {
      page.off("request", trackDirectMutation);

      await page.evaluate(
        async ({
          expectedLocalListId,
          expectedServerListId,
          expectedTagId,
          expectedLocalListName,
        }) => {
          const localDb = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("tidy-local-db");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });

          try {
            const storeNames = [
              "lists",
              "tags",
              "listTags",
              "viewLists",
              "outboxOperations",
            ].filter((storeName) =>
              localDb.objectStoreNames.contains(storeName),
            );
            const transaction = localDb.transaction(storeNames, "readwrite");
            const readAll = <T,>(storeName: string) =>
              new Promise<T[]>((resolve, reject) => {
                const request = transaction.objectStore(storeName).getAll();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
              });
            const [lists, listTags, viewLists, operations] = await Promise.all([
              readAll<{ clientId: string; name: string }>("lists"),
              readAll<{
                clientId: string;
                listClientId: string;
                tagClientId: string;
              }>("listTags"),
              readAll<{ clientId: string; listClientId: string }>("viewLists"),
              readAll<{
                operationId: string;
                entityClientId: string;
                payload?: { name?: string };
              }>("outboxOperations"),
            ]);
            const localIds = lists
              .filter(
                (list) =>
                  list.clientId === expectedServerListId ||
                  list.clientId === expectedLocalListId ||
                  list.name === expectedLocalListName,
              )
              .map((list) => list.clientId);

            for (const listId of localIds) {
              transaction.objectStore("lists").delete(listId);
            }
            transaction.objectStore("tags").delete(expectedTagId);

            for (const listTag of listTags) {
              if (
                localIds.includes(listTag.listClientId) ||
                listTag.tagClientId === expectedTagId
              ) {
                transaction.objectStore("listTags").delete(listTag.clientId);
              }
            }
            for (const viewList of viewLists) {
              if (localIds.includes(viewList.listClientId)) {
                transaction.objectStore("viewLists").delete(viewList.clientId);
              }
            }
            for (const operation of operations) {
              if (
                localIds.includes(operation.entityClientId) ||
                operation.entityClientId ===
                  `${expectedLocalListId}:${expectedTagId}` ||
                operation.payload?.name === expectedLocalListName
              ) {
                transaction
                  .objectStore("outboxOperations")
                  .delete(operation.operationId);
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
          expectedLocalListId: localListId,
          expectedServerListId: serverListId,
          expectedTagId: tagId,
          expectedLocalListName: localListName,
        },
      );

      await page.unroute("**/api/sync", blockSync);
      await db.list.deleteMany({
        where: {
          id: serverListId,
          userId: identity!.userId,
        },
      });
      await db.tag.deleteMany({
        where: {
          id: tagId,
          userId: identity!.userId,
        },
      });
    }
  });
});
