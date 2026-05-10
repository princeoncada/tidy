import { expect, test } from "@playwright/test";

import { authStorageState, gotoDashboardOrSkip } from "./utils/seed";

test.use(authStorageState ? { storageState: authStorageState } : {});

test("app loads successfully", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Simple Todo App")).toBeVisible();
});

test("no critical console errors on initial page load", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByText("Simple Todo App")).toBeVisible();
  expect(errors).toEqual([]);
});

test("main app shell is visible", async ({ page }) => {
  await gotoDashboardOrSkip(page);
});
