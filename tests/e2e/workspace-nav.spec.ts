import { expect, test } from "./utils/fixtures";

import { createList, deleteList, openAllLists, openWorkspacesDropdown } from "./utils/app";
import { expectListNotVisible, expectListVisible } from "./utils/assertions";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  gotoDashboard,
  uniqueTestName,
} from "./utils/seed";
import { dragByMouse } from "./utils/drag";
import { testIds } from "./utils/test-ids";

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

  const workspacesTrigger = page.getByRole("button", {
    name: "Workspaces",
    exact: true,
  });
  await workspacesTrigger.click();
  await page.getByTestId(testIds.workspaceAddButton).click();
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

  await openWorkspacesDropdown(page);
  const workspaceButton = page.getByRole("button", {
    name: workspaceName,
    exact: true,
  });
  await expect(workspaceButton).toBeVisible();
  await workspaceButton.focus();
  await expect(workspaceButton).toBeFocused();
  await workspaceButton.press("Enter");

  await openWorkspacesDropdown(page);
  const selectedWorkspaceButton = page.getByRole("button", {
    name: workspaceName,
    exact: true,
  });
  await expect(selectedWorkspaceButton).toHaveAttribute("aria-current", "page");
  await expect(
    selectedWorkspaceButton.getByTestId(testIds.workspaceSelectedIndicator),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expectListVisible(page, assignedList);
  await expectListNotVisible(page, unassignedList);

  await openWorkspacesDropdown(page);
  const allWorkspacesButton = page.getByRole("button", {
    name: "All workspaces",
    exact: true,
  });
  await allWorkspacesButton.focus();
  await allWorkspacesButton.press("Space");

  await openWorkspacesDropdown(page);
  const selectedAllWorkspacesButton = page.getByRole("button", {
    name: "All workspaces",
    exact: true,
  });
  await expect(selectedAllWorkspacesButton).toHaveAttribute("aria-current", "page");
  await expect(
    selectedAllWorkspacesButton.getByTestId(testIds.workspaceSelectedIndicator),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expectListVisible(page, assignedList);
  await expectListVisible(page, unassignedList);

  await deleteList(page, assignedList);
  await deleteList(page, unassignedList);
});

test("sidebar navigation supports add, workspace reorder, fixed collapse, footer account, and full-width canvas", async ({ page }) => {
  const sidebarList = uniqueTestName("sidebar-list");
  await createList(page, sidebarList);
  await expectListVisible(page, sidebarList);

  const workspacesTrigger = page.getByRole("button", {
    name: "Workspaces",
    exact: true,
  });
  const workspaceNames = [
    uniqueTestName("workspace-reorder-first"),
    uniqueTestName("workspace-reorder-second"),
  ];

  for (const workspaceName of workspaceNames) {
    await workspacesTrigger.click();
    await page.getByTestId(testIds.workspaceAddButton).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Workspace name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  await workspacesTrigger.click();
  const rows = page.getByTestId(testIds.workspaceRow);
  const firstRow = rows.filter({ hasText: workspaceNames[0] });
  const secondRow = rows.filter({ hasText: workspaceNames[1] });
  const reordered = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes("reorderWorkspace"),
  );
  await dragByMouse(
    page,
    secondRow.getByTestId(testIds.workspaceDragHandle),
    firstRow.getByTestId(testIds.workspaceDragHandle),
  );
  await reordered;
  await expect.poll(async () => {
    const names = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.textContent ?? ""),
    );
    const firstIndex = names.findIndex((name) => name.includes(workspaceNames[0]));
    const secondIndex = names.findIndex((name) => name.includes(workspaceNames[1]));
    return secondIndex >= 0 && firstIndex >= 0 && secondIndex < firstIndex;
  }).toBe(true);
  await page.keyboard.press("Escape");

  const collapse = page.getByTestId(testIds.sidebarCollapseToggle);
  const before = await collapse.boundingBox();
  await collapse.click();
  const after = await collapse.boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.y).toBe(before?.y);
  await collapse.click();

  await page.getByTestId(testIds.accountMenuTrigger).click();
  await expect(page.getByTestId(testIds.accountMenuContent)).toHaveAttribute("data-side", "top");
  await page.keyboard.press("Escape");

  const fullWidthCanvas = page.getByTestId(testIds.fullWidthCanvas);
  await expect(fullWidthCanvas).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await deleteList(page, sidebarList);
});
