import { expect, type Locator, type Page } from "@playwright/test";

import { waitForSyncBatch } from "./app";

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

export async function dragByMouse(page: Page, source: Locator, target: Locator) {
  const from = await center(source);
  const to = await center(target);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });

  if (await target.getAttribute("data-testid") === "list-drop-zone") {
    await expect(target.locator("xpath=..")).toHaveClass(/border-zinc-400/, {
      timeout: 5_000,
    });
  }

  await page.mouse.up();

  await expect(page.locator('[data-dnd-dragging="true"]')).toHaveCount(0, {
    timeout: 5_000,
  });
  await expect(page.locator("[data-dnd-placeholder]")).toHaveCount(0, {
    timeout: 5_000,
  });
}

export async function dragByMouseAndWaitForMutation(
  page: Page,
  source: Locator,
  target: Locator
) {
  const persisted = waitForSyncBatch(page);

  await dragByMouse(page, source, target);
  await persisted;
}
