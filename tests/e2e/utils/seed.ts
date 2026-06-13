import { expect, type Page } from "@playwright/test";

import { getListCards, getVisibleListCard } from "./assertions";
import { testIds } from "./test-ids";

const parallelIndex = process.env.TEST_PARALLEL_INDEX ?? "0";
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
let sequence = 0;

export type E2eUser = { email: string; password: string };

export function resolveE2eUserPool(): E2eUser[] {
  const pool: E2eUser[] = [];
  for (let i = 1; ; i += 1) {
    const email = process.env[`E2E_TEST_EMAIL_${i}`];
    const password = process.env[`E2E_TEST_PASSWORD_${i}`];
    if (!email || !password) break;
    pool.push({ email, password });
  }
  if (pool.length === 0) {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (email && password) pool.push({ email, password });
  }
  return pool;
}

export function authStoragePathForIndex(index: number) {
  return `tests/.auth/user-${index}.json`;
}

export function uniqueTestName(prefix: string) {
  sequence += 1;
  const suffix = `w${parallelIndex}-${runId}-${String(sequence).padStart(3, "0")}`;
  return `e2e-${prefix}-${suffix}`;
}

async function clearTidyLocalDb(page: Page) {
  await page.goto("/sw.js", { waitUntil: "domcontentloaded" });
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("tidy-local-db");

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to delete tidy-local-db."));
      request.onblocked = () =>
        reject(new Error("Deleting tidy-local-db was blocked by an open connection."));
    })
  );
}

export async function gotoDashboard(page: Page) {
  await clearTidyLocalDb(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId(testIds.appShell)).toBeVisible();
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    const locationUrl = message.location().url;
    const isOptimisticViewCreate404 =
      message.type() === "error" &&
      message.text().includes("404") &&
      locationUrl.includes("/api/trpc/view.getViewListsWithItems");

    // Custom view creation optimistically fetches its view payload before the
    // server create can commit; that transient 404 self-heals on refetch.
    if (isOptimisticViewCreate404) return;

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
  const matchingCards = getListCards(page).filter({ hasText: name });

  if (await matchingCards.count() === 0) return;

  const card = await getVisibleListCard(page, name);
  await card.getByRole("button", { name: /list options/i }).click();
  await page.getByTestId(testIds.deleteListButton).click();
  await expect(matchingCards).toHaveCount(0);
}
