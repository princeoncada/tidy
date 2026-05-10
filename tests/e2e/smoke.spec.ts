import { expect, test } from "@playwright/test";

test("app loads successfully", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Simple Todo App")).toBeVisible();
});

test("no critical console errors on initial page load", async ({ page }) => {
  const errors: string[] = [];

  const ignoredConsoleErrors = [
    "webpack-hmr",
    "WebSocket connection",
    "ERR_INVALID_HTTP_RESPONSE",
  ];

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const text = message.text();
    const isIgnored = ignoredConsoleErrors.some((ignoredError) =>
      text.includes(ignoredError),
    );

    if (!isIgnored) {
      errors.push(text);
    }
  });

  await page.goto("/");
  await expect(page.getByText("Simple Todo App")).toBeVisible();

  expect(errors).toEqual([]);
});

test("login page loads successfully", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Login to your account")).toBeVisible();
});