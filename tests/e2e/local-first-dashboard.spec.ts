import { type Page } from "@playwright/test";

import { createList, openAllLists } from "./utils/app";
import { expectListVisible, getVisibleListCard } from "./utils/assertions";
import { expect, test } from "./utils/fixtures";
import { cleanupNamedList, gotoDashboard, uniqueTestName } from "./utils/seed";

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
