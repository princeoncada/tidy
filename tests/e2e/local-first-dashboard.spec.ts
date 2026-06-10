import { type Page } from "@playwright/test";

import {
  createList,
  createListAndImmediatelyAddItem,
  openAllLists,
} from "./utils/app";
import {
  expectItemInList,
  expectListVisible,
  expectNoDuplicateText,
  getVisibleListCard,
} from "./utils/assertions";
import { expect, test } from "./utils/fixtures";
import { cleanupNamedList, gotoDashboard, uniqueTestName } from "./utils/seed";
import { testIds } from "./utils/test-ids";

const TRPC_ROUTE = "**/api/trpc/**";

async function expectLocalListStored(page: Page, name: string) {
  await page.waitForFunction(
    async (expectedName) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tidy-local-db");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        if (!db.objectStoreNames.contains("lists")) return false;

        const rows = await new Promise<Array<{ name?: string; deletedAt?: string | null }>>(
          (resolve, reject) => {
            const transaction = db.transaction("lists", "readonly");
            const request = transaction.objectStore("lists").getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          },
        );

        return rows.some((row) => row.name === expectedName && row.deletedAt === null);
      } finally {
        db.close();
      }
    },
    name,
  );
}

async function expectLocalItemStored(page: Page, name: string) {
  await page.waitForFunction(
    async (expectedName) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tidy-local-db");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        if (!db.objectStoreNames.contains("listItems")) return false;

        const rows = await new Promise<Array<{ name?: string; deletedAt?: string | null }>>(
          (resolve, reject) => {
            const transaction = db.transaction("listItems", "readonly");
            const request = transaction.objectStore("listItems").getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          },
        );

        return rows.some((row) => row.name === expectedName && row.deletedAt === null);
      } finally {
        db.close();
      }
    },
    name,
  );
}

test.beforeEach(async ({ page }) => {
  await gotoDashboard(page);
  await openAllLists(page);
});

test("renders a list from Dexie when the tRPC API is blocked (app already loaded)", async ({ page }) => {
  const name = uniqueTestName("local-first-api-blocked");

  // Online: creating the list persists it to the server AND to Dexie (existing create-list slice).
  await createList(page, name);
  await expectLocalListStored(page, name);

  // Block ONLY the tRPC API; the rest of the network and the app shell stay reachable.
  // This is the 1.9.20 API-unavailable path, distinct from 1.9.19's full-offline reload.
  await page.route(TRPC_ROUTE, (route) => route.abort());

  // Re-mount with the API unreachable: the boot hook reads Dexie and the render gate
  // falls back to the local snapshot instead of an empty/error state.
  await page.reload();
  await expectListVisible(page, name);

  // Restore the API and clean up the server-side row.
  await page.unroute(TRPC_ROUTE);
  await cleanupNamedList(page, name);
});

test("keeps the Dexie fallback inert while the tRPC API is reachable", async ({ page }) => {
  const name = uniqueTestName("local-first-online");

  await createList(page, name);
  await expect(await getVisibleListCard(page, name)).toBeVisible();

  await cleanupNamedList(page, name);
});

test("renders one complete rapid-create graph after reload with the API blocked", async ({ page }) => {
  const listName = uniqueTestName("local-first-rapid-list");
  const itemName = uniqueTestName("local-first-rapid-item");
  const duplicateKeyErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /same key|unique "key"/i.test(message.text())
    ) {
      duplicateKeyErrors.push(message.text());
    }
  });

  await createListAndImmediatelyAddItem(page, listName, itemName);
  await expectLocalListStored(page, listName);
  await expectLocalItemStored(page, itemName);

  await page.route(TRPC_ROUTE, (route) => route.abort());
  await page.reload();

  await expectListVisible(page, listName);
  await expectItemInList(page, listName, itemName);
  await expectNoDuplicateText(page, listName);
  await expectNoDuplicateText(page, itemName);

  const card = await getVisibleListCard(page, listName);
  await expect(card.getByTestId(testIds.listItem)).toHaveCount(1);
  expect(duplicateKeyErrors).toEqual([]);

  await page.unroute(TRPC_ROUTE);
  await page.reload();
  await cleanupNamedList(page, listName);
});
