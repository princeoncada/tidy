import { expect, type Page } from "@playwright/test";

export const authStoragePath = "tests/.auth/user.json";
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
let sequence = 0;

export function uniqueTestName(prefix: string) {
  sequence += 1;
  const suffix = `${runId}-${String(sequence).padStart(3, "0")}`;
  return `e2e-${prefix}-${suffix}`;
}

export async function gotoDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  return errors;
}

export function expectNoConsoleErrors(errors: string[]) {
  expect(errors).toEqual([]);
}

export async function cleanupNamedList(page: Page, name: string) {
  const card = page.getByTestId("list-card").filter({ hasText: name }).first();

  if (await card.count() === 0) return;

  await card.getByRole("button", { name: /list options/i }).click();
  await page.getByTestId("delete-list-button").click();
  await expect(page.getByTestId("list-card").filter({ hasText: name })).toHaveCount(0);
}
