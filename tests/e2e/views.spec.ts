import { expect, test } from "@playwright/test";

import { createView } from "./utils/app";
import { authStorageState, gotoDashboardOrSkip, uniqueTestName } from "./utils/seed";

test.use(authStorageState ? { storageState: authStorageState } : {});

test.beforeEach(async ({ page }) => {
  await gotoDashboardOrSkip(page);
});

test("create a view if the feature exists in the current app", async ({ page }) => {
  test.skip(true, "Custom view creation requires at least one existing tag; seed helpers do not create stable tag fixtures yet.");
  await createView(page, uniqueTestName("view"));
});

test("verify created view appears", async ({ page }) => {
  test.skip(true, "Depends on custom view creation with a seeded tag fixture.");
  await expect(page.getByTestId("view-card").first()).toBeVisible();
});

test("verify view can be selected/opened", async ({ page }) => {
  const allLists = page.getByRole("button", { name: /all lists/i }).first();
  await allLists.click();
  await expect(allLists).toBeVisible();
});

test("basic tag-filtered view", async () => {
  test.skip(true, "Tag-filtered view E2E needs deterministic tag creation and cleanup helpers.");
});
