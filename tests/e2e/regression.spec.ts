import { test } from "@playwright/test";

import { createItem, createList } from "./utils/app";
import { expectNoDuplicateText, reloadAndExpectPersisted } from "./utils/assertions";
import { authStorageState, cleanupNamedList, gotoDashboardOrSkip, uniqueTestName } from "./utils/seed";

test.use(authStorageState ? { storageState: authStorageState } : {});

test.beforeEach(async ({ page }) => {
  await gotoDashboardOrSkip(page);
});

test("rapid create 5 lists, reload, and verify no duplicate visible names", async ({ page }) => {
  const names = Array.from({ length: 5 }, (_, index) => uniqueTestName(`rapid-list-${index}`));
  for (const name of names) await createList(page, name);
  await reloadAndExpectPersisted(page, names[0]);
  for (const name of names) await expectNoDuplicateText(page, name);
  for (const name of names) await cleanupNamedList(page, name);
});

test("rapid create 5 items in one list, reload, and verify no duplicate visible names", async ({ page }) => {
  const listName = uniqueTestName("rapid-items-list");
  const itemNames = Array.from({ length: 5 }, (_, index) => uniqueTestName(`rapid-item-${index}`));
  await createList(page, listName);
  for (const itemName of itemNames) await createItem(page, listName, itemName);
  await reloadAndExpectPersisted(page, itemNames[0]);
  for (const itemName of itemNames) await expectNoDuplicateText(page, itemName);
  await cleanupNamedList(page, listName);
});
