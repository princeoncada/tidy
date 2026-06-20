import { expect, test } from "./utils/fixtures";

import { createList, deleteList, openAllLists } from "./utils/app";
import { expectListNotVisible, expectListVisible } from "./utils/assertions";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  gotoDashboard,
  uniqueTestName,
} from "./utils/seed";

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = collectConsoleErrors(page);
  await gotoDashboard(page);
  await openAllLists(page);
});

test.afterEach(async () => {
  expectNoConsoleErrors(consoleErrors);
});

test("workspace navigation filters synced lists and is keyboard operable", async ({ page }) => {
  const assignedList = uniqueTestName("workspace-assigned-list");
  const unassignedList = uniqueTestName("workspace-unassigned-list");
  const workspaceName = uniqueTestName("workspace-nav");

  await createList(page, assignedList);
  await createList(page, unassignedList);

  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(workspaceName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  const workspaceCard = dialog.locator(".rounded-lg").filter({
    hasText: workspaceName,
  });
  const assignedCheckbox = workspaceCard.getByRole("checkbox", {
    name: assignedList,
  });

  await expect(assignedCheckbox).toBeVisible();
  await assignedCheckbox.click();
  await expect(assignedCheckbox).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const workspaceButton = page.getByRole("button", {
    name: workspaceName,
    exact: true,
  });
  await expect(workspaceButton).toBeVisible();
  await workspaceButton.focus();
  await expect(workspaceButton).toBeFocused();
  await workspaceButton.press("Enter");

  await expect(workspaceButton).toHaveAttribute("aria-current", "page");
  await expect(
    workspaceButton.getByTestId("workspace-selected-indicator"),
  ).toBeVisible();
  await expectListVisible(page, assignedList);
  await expectListNotVisible(page, unassignedList);

  const allWorkspacesButton = page.getByRole("button", {
    name: "All workspaces",
    exact: true,
  });
  await allWorkspacesButton.focus();
  await allWorkspacesButton.press("Space");

  await expect(allWorkspacesButton).toHaveAttribute("aria-current", "page");
  await expect(
    allWorkspacesButton.getByTestId("workspace-selected-indicator"),
  ).toBeVisible();
  await expectListVisible(page, assignedList);
  await expectListVisible(page, unassignedList);

  await deleteList(page, assignedList);
  await deleteList(page, unassignedList);
});
