import { test } from "@playwright/test";

import { createItem, createList } from "./utils/app";
import { expectItemInList, expectItemNotInList, expectListOrder } from "./utils/assertions";
import { dragByMouse } from "./utils/drag";
import { cleanupNamedList, collectConsoleErrors, expectNoConsoleErrors, gotoDashboard, uniqueTestName } from "./utils/seed";
import { testIds } from "./utils/test-ids";

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("reorder lists if drag/drop is currently implemented", async ({ page }) => {
  const first = uniqueTestName("drag-list-first");
  const second = uniqueTestName("drag-list-second");
  await createList(page, first);
  await createList(page, second);

  const firstCard = page.getByTestId(testIds.listCard).filter({ hasText: first }).first();
  const secondCard = page.getByTestId(testIds.listCard).filter({ hasText: second }).first();
  await expectListOrder(page, [second, first]);

  await dragByMouse(
    page,
    firstCard.getByTestId(testIds.listDragHandle),
    secondCard.getByTestId(testIds.listDragHandle)
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
  await createList(page, sourceList);
  await createList(page, targetList);
  await createItem(page, sourceList, itemName);

  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName }).first();
  const targetCard = page.getByTestId(testIds.listCard).filter({ hasText: targetList }).first();
  await dragByMouse(
    page,
    item.getByTestId(testIds.itemDragHandle),
    targetCard.getByTestId(testIds.listDropZone)
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
  await createList(page, sourceList);
  await createList(page, targetList);
  await createItem(page, sourceList, itemName);

  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName }).first();
  const targetCard = page.getByTestId(testIds.listCard).filter({ hasText: targetList }).first();
  await dragByMouse(page, item.getByTestId(testIds.itemDragHandle), targetCard.getByTestId(testIds.listDropZone));

  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await page.reload();
  await expectItemNotInList(page, sourceList, itemName);
  await expectItemInList(page, targetList, itemName);
  await cleanupNamedList(page, sourceList);
  await cleanupNamedList(page, targetList);
});
