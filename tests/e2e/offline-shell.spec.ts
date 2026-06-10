import { expect, test } from "@playwright/test";

test("offline reload serves the cached landing shell", async ({ context, page }) => {
  await page.goto("/");
  await expect(page.getByText("Simple Todo App")).toBeVisible();

  const hasActiveWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  expect(hasActiveWorker).toBe(true);

  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page.getByText("Simple Todo App")).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByText("Simple Todo App")).toBeVisible();
});
