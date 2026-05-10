import { test } from "@playwright/test";

import { createList, deleteList, renameList } from "./utils/app";
import { expectListNotVisible, expectListVisible, reloadAndExpectMissing, reloadAndExpectPersisted } from "./utils/assertions";
import { cleanupNamedList, collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("create a list", async ({ page }) => {
  const name = uniqueTestName("list-create");
  await createList(page, name);
  await expectListVisible(page, name);
  await reloadAndExpectPersisted(page, name);
  await cleanupNamedList(page, name);
});

test("rename a list", async ({ page }) => {
  const originalName = uniqueTestName("list-rename-original");
  const renamedName = uniqueTestName("list-rename-final");
  await createList(page, originalName);
  await renameList(page, originalName, renamedName);
  await reloadAndExpectPersisted(page, renamedName);
  await expectListNotVisible(page, originalName);
  await cleanupNamedList(page, renamedName);
});

test("delete a list", async ({ page }) => {
  const name = uniqueTestName("list-delete");
  await createList(page, name);
  await deleteList(page, name);
  await reloadAndExpectMissing(page, name);
});

test("create multiple lists", async ({ page }) => {
  const names = [uniqueTestName("multi-list-a"), uniqueTestName("multi-list-b"), uniqueTestName("multi-list-c")];
  for (const name of names) await createList(page, name);
  for (const name of names) await expectListVisible(page, name);
  await page.reload();
  for (const name of names) await expectListVisible(page, name);
  for (const name of names) await cleanupNamedList(page, name);
});

test("refresh keeps created list visible if persistence exists", async ({ page }) => {
  const name = uniqueTestName("list-persist");
  await createList(page, name);
  await reloadAndExpectPersisted(page, name);
  await cleanupNamedList(page, name);
});
