import { test } from "@playwright/test";

import { createItem, createList, deleteItem, renameItem } from "./utils/app";
import { expectItemVisible, reloadAndExpectPersisted } from "./utils/assertions";
import { authStorageState, cleanupNamedList, gotoDashboardOrSkip, uniqueTestName } from "./utils/seed";

test.use(authStorageState ? { storageState: authStorageState } : {});

test.beforeEach(async ({ page }) => {
  await gotoDashboardOrSkip(page);
});

test("create item inside a list", async ({ page }) => {
  const listName = uniqueTestName("item-list");
  const itemName = uniqueTestName("item-create");
  await createList(page, listName);
  await createItem(page, listName, itemName);
  await expectItemVisible(page, itemName);
  await cleanupNamedList(page, listName);
});

test("create multiple items", async ({ page }) => {
  const listName = uniqueTestName("items-list");
  const items = [uniqueTestName("item-a"), uniqueTestName("item-b"), uniqueTestName("item-c")];
  await createList(page, listName);
  for (const item of items) await createItem(page, listName, item);
  for (const item of items) await expectItemVisible(page, item);
  await cleanupNamedList(page, listName);
});

test("rename item if supported", async ({ page }) => {
  const listName = uniqueTestName("rename-item-list");
  const itemName = uniqueTestName("item-original");
  const renamedItem = uniqueTestName("item-renamed");
  await createList(page, listName);
  await createItem(page, listName, itemName);
  await renameItem(page, itemName, renamedItem);
  await cleanupNamedList(page, listName);
});

test("delete item if supported", async ({ page }) => {
  const listName = uniqueTestName("delete-item-list");
  const itemName = uniqueTestName("item-delete");
  await createList(page, listName);
  await createItem(page, listName, itemName);
  await deleteItem(page, itemName);
  await cleanupNamedList(page, listName);
});

test("refresh keeps item visible if persistence exists", async ({ page }) => {
  const listName = uniqueTestName("persist-item-list");
  const itemName = uniqueTestName("item-persist");
  await createList(page, listName);
  await createItem(page, listName, itemName);
  await reloadAndExpectPersisted(page, itemName);
  await cleanupNamedList(page, listName);
});
