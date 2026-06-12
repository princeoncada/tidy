import { config } from "dotenv";
import type { Page, Request } from "@playwright/test";

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

async function getLocalUserAndAllListsView(page: Page) {
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

async function readOutboxOperationByPayloadName(page: Page, name: string) {
  return page.evaluate(async (expectedName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tidy-local-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    try {
      const operations = await new Promise<
        Array<{
          operationId: string;
          entityClientId: string;
          payload: { name?: string };
          status: string;
        }>
      >((resolve, reject) => {
        const transaction = db.transaction("outboxOperations", "readonly");
        const request = transaction.objectStore("outboxOperations").getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      return (
        operations.find((operation) => operation.payload.name === expectedName) ??
        null
      );
    } finally {
      db.close();
    }
  }, name);
}

async function waitForOutboxOperationStatus(
  page: Page,
  name: string,
  status: string,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const operation = await readOutboxOperationByPayloadName(page, name);

    if (operation?.status === status) {
      return operation;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for ${name} to reach ${status}.`);
}

function requestContainsEntity(
  request: Request,
  predicate: (operation: {
    entityClientId?: string;
    payload?: { name?: string };
  }) => boolean,
) {
  if (
    request.method() !== "POST" ||
    !request.url().includes("/api/sync")
  ) {
    return false;
  }

  try {
    const body = request.postDataJSON() as {
      operations?: Array<{
        operation?: {
          entityClientId?: string;
          payload?: { name?: string };
        };
      }>;
    };
    return body.operations?.some((entry) =>
      entry.operation ? predicate(entry.operation) : false,
    ) ?? false;
  } catch {
    return false;
  }
}

async function createListWithoutDirectMutationWait(page: Page, name: string) {
  const createListButton = await firstVisible(
    page.getByTestId(testIds.createListButton),
  );
  await createListButton.click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Enter your list name...").fill(name);
  await dialog.getByRole("button", { name: "Create List" }).click();
  await expect(await getVisibleListCard(page, name)).toBeVisible();
}

async function markOperationSyncing(page: Page, operationId: string) {
  await page.evaluate(async (expectedOperationId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tidy-local-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    try {
      const transaction = db.transaction("outboxOperations", "readwrite");
      const store = transaction.objectStore("outboxOperations");
      const operation = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          const request = store.get(expectedOperationId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        },
      );
      store.put({
        ...operation,
        status: "syncing",
        lastAttemptedAt: new Date().toISOString(),
      });
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }, operationId);
}

async function cleanupLocalLifecycleData(
  page: Page,
  {
    listIds = [],
    itemIds = [],
    payloadNames = [],
  }: {
    listIds?: string[];
    itemIds?: string[];
    payloadNames?: string[];
  },
) {
  await page.evaluate(
    async ({
      expectedListIds,
      expectedItemIds,
      expectedPayloadNames,
    }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tidy-local-db");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        const storeNames = [
          "lists",
          "listItems",
          "viewLists",
          "outboxOperations",
        ].filter((storeName) => db.objectStoreNames.contains(storeName));
        const transaction = db.transaction(storeNames, "readwrite");

        for (const listId of expectedListIds) {
          transaction.objectStore("lists").delete(listId);
        }
        for (const itemId of expectedItemIds) {
          transaction.objectStore("listItems").delete(itemId);
        }

        const viewLists = await new Promise<
          Array<{ clientId: string; listClientId: string }>
        >((resolve, reject) => {
          const request = transaction.objectStore("viewLists").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        for (const viewList of viewLists) {
          if (expectedListIds.includes(viewList.listClientId)) {
            transaction.objectStore("viewLists").delete(viewList.clientId);
          }
        }

        const operations = await new Promise<
          Array<{
            operationId: string;
            entityClientId: string;
            payload?: { name?: string };
          }>
        >((resolve, reject) => {
          const request = transaction
            .objectStore("outboxOperations")
            .getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        for (const operation of operations) {
          if (
            expectedListIds.includes(operation.entityClientId) ||
            expectedItemIds.includes(operation.entityClientId) ||
            (operation.payload?.name &&
              expectedPayloadNames.includes(operation.payload.name))
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
        db.close();
      }
    },
    {
      expectedListIds: listIds,
      expectedItemIds: itemIds,
      expectedPayloadNames: payloadNames,
    },
  );
}

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
  await openAllLists(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test.describe("Dexie-first sync lifecycle", () => {
  test.skip(
    () =>
      process.env.NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED !== "true",
    "Run this targeted proof with NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED=true.",
  );

  test("sync lifecycle batches a mutation burst into one sync request", async ({
    page,
  }) => {
    const identity = await getLocalUserAndAllListsView(page);
    expect(identity).not.toBeNull();

    const { db } = await import("@/lib/db");
    const listId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const listName = uniqueTestName("sync-lifecycle-batch-list");
    const itemName = uniqueTestName("sync-lifecycle-batch-item");
    const syncRequests: Request[] = [];
    const trackSyncRequest = (request: Request) => {
      if (
        requestContainsEntity(
          request,
          (operation) => operation.entityClientId === itemId,
        )
      ) {
        syncRequests.push(request);
      }
    };

    try {
      await db.$transaction(async (tx) => {
        await tx.list.create({
          data: {
            id: listId,
            name: listName,
            userId: identity!.userId,
          },
        });
        await tx.listItem.create({
          data: {
            id: itemId,
            name: itemName,
            listId,
            order: 0,
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
      const item = await firstVisible(
        listCard.getByTestId(testIds.listItem).filter({ hasText: itemName }),
      );
      const checkbox = item.getByRole("checkbox");

      page.on("request", trackSyncRequest);
      await checkbox.click();
      await checkbox.click();
      await checkbox.click();

      await expect
        .poll(() => syncRequests.length, { timeout: 10_000 })
        .toBe(1);
      await page.waitForTimeout(1_200);
      expect(syncRequests).toHaveLength(1);
    } finally {
      page.off("request", trackSyncRequest);
      await cleanupLocalLifecycleData(page, {
        listIds: [listId],
        itemIds: [itemId],
      });
      await db.list.deleteMany({
        where: {
          id: listId,
          userId: identity!.userId,
        },
      });
    }
  });

  test("sync lifecycle recovers a queued operation across reload", async ({
    page,
  }) => {
    const identity = await getLocalUserAndAllListsView(page);
    expect(identity).not.toBeNull();

    const { db } = await import("@/lib/db");
    const listName = uniqueTestName("sync-lifecycle-reload-list");
    let localListId: string | null = null;
    const syncRequests: Request[] = [];
    const trackSyncRequest = (request: Request) => {
      if (
        requestContainsEntity(
          request,
          (operation) => operation.payload?.name === listName,
        )
      ) {
        syncRequests.push(request);
      }
    };

    page.on("request", trackSyncRequest);

    try {
      await createListWithoutDirectMutationWait(page, listName);
      const pending = await waitForOutboxOperationStatus(
        page,
        listName,
        "pending",
      );
      localListId = pending.entityClientId;
      await markOperationSyncing(page, pending.operationId);

      await page.reload();
      await openAllLists(page);

      const synced = await waitForOutboxOperationStatus(
        page,
        listName,
        "synced",
      );
      expect(synced.entityClientId).toBe(pending.entityClientId);
      expect(syncRequests).toHaveLength(1);
      await page.reload();
      await openAllLists(page);
      await expect(await getVisibleListCard(page, listName)).toBeVisible();
    } finally {
      page.off("request", trackSyncRequest);
      await cleanupLocalLifecycleData(page, {
        listIds: localListId ? [localListId] : [],
        payloadNames: [listName],
      });
      await db.list.deleteMany({
        where: {
          name: listName,
          userId: identity!.userId,
        },
      });
    }
  });
});
