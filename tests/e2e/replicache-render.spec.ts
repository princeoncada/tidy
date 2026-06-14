import { expect, test } from "./utils/fixtures";
import type { Page } from "@playwright/test";

import {
  expectItemInList,
  firstVisible,
  getVisibleListCard,
} from "./utils/assertions";
import { dragByMouse } from "./utils/drag";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  gotoDashboard,
  uniqueTestName,
} from "./utils/seed";
import { testIds } from "./utils/test-ids";

async function waitForReplicachePush(page: Page) {
  const response = await page.waitForResponse((candidate) =>
    candidate.request().method() === "POST" &&
    candidate.url().includes("/api/replicache/push")
  );
  const responseBody = await response.text();

  expect(
    response.ok(),
    `Replicache push failed with HTTP ${response.status()}: ${responseBody}`,
  ).toBe(true);

  return response;
}

async function createReplicacheList(
  page: Page,
  name: string,
) {
  const pushed = waitForReplicachePush(page);
  await (await firstVisible(page.getByTestId(testIds.createListButton))).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Enter your list name...").fill(name);
  await dialog.getByRole("button", { name: "Create List" }).click();
  await expect(await getVisibleListCard(page, name)).toBeVisible();
  await pushed;
}

test("Replicache renders create, edit, and move locally without rollback flicker", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  const firstList = uniqueTestName("replicache-first");
  const secondList = uniqueTestName("replicache-second");
  const itemName = uniqueTestName("replicache-item");
  const renamedItem = `${itemName}-renamed`;

  await gotoDashboard(page);

  let releaseFirstPush!: () => void;
  let reportFirstPushBlocked!: () => void;
  const firstPushBlocked = new Promise<void>((resolve) => {
    reportFirstPushBlocked = resolve;
  });
  let firstPush = true;
  await page.route("**/api/replicache/push", async (route) => {
    if (firstPush) {
      firstPush = false;
      await new Promise<void>((resolve) => {
        releaseFirstPush = resolve;
        reportFirstPushBlocked();
      });
    }
    await route.continue();
  });

  const createButton = await firstVisible(
    page.getByTestId(testIds.createListButton),
  );
  await createButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Enter your list name...").fill(firstList);
  await dialog.getByRole("button", { name: "Create List" }).click();
  await expect(await getVisibleListCard(page, firstList)).toBeVisible();
  await expect(page.getByText("Something went wrong...")).toHaveCount(0);
  await firstPushBlocked;
  const firstPushed = waitForReplicachePush(page);
  releaseFirstPush();
  await firstPushed;
  await page.unroute("**/api/replicache/push");

  await createReplicacheList(page, secondList);

  const firstCard = await getVisibleListCard(page, firstList);
  await firstCard.getByRole("button", { name: /list options/i }).click();
  await page.getByRole("menuitem", { name: "Add Item" }).click();
  const itemPushed = waitForReplicachePush(page);
  await firstCard.getByTestId(testIds.createItemInput).fill(itemName);
  await firstCard.getByTestId(testIds.createItemInput).press("Enter");
  await expect(firstCard.getByText(itemName, { exact: true })).toBeVisible();
  await itemPushed;

  const item = page.getByTestId(testIds.listItem).filter({ hasText: itemName });
  await item.getByTestId(testIds.listItemTitle).click();
  const renamePushed = waitForReplicachePush(page);
  const renameInput = await firstVisible(
    page.getByTestId(testIds.listTitleInput),
  );
  await renameInput.fill(renamedItem);
  await renameInput.press("Enter");
  await expect(page.getByText(renamedItem, { exact: true })).toBeVisible();
  await renamePushed;

  const secondCard = await getVisibleListCard(page, secondList);
  const movePushed = waitForReplicachePush(page);
  await dragByMouse(
    page,
    item.getByTestId(testIds.itemDragHandle),
    secondCard.getByTestId(testIds.listDropZone),
  );
  await expectItemInList(page, secondList, renamedItem);
  await movePushed;

  await page.reload();
  await expectItemInList(page, secondList, renamedItem);
  expectNoConsoleErrors(consoleErrors);
});
