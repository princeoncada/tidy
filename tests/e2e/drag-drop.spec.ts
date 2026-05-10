import { test } from "@playwright/test";

import { authStorageState, gotoDashboardOrSkip } from "./utils/seed";

test.use(authStorageState ? { storageState: authStorageState } : {});

test.beforeEach(async ({ page }) => {
  await gotoDashboardOrSkip(page);
});

test("reorder lists if drag/drop is currently implemented", async () => {
  test.skip(true, "TODO: add deterministic dnd-kit pointer helper for list drag handles before enabling.");
});

test("move item between lists if implemented", async () => {
  test.skip(true, "TODO: add deterministic dnd-kit pointer helper for item drag handles before enabling.");
});

test("move item into empty list if implemented", async () => {
  test.skip(true, "TODO: add deterministic dnd-kit pointer helper and empty-list fixture before enabling.");
});
