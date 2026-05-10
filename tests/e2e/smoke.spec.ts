import { expect, test } from "@playwright/test";

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

test("login page loads successfully", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Login to your account")).toBeVisible();
});
