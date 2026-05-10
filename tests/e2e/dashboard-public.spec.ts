import { expect, test } from "@playwright/test";

test("unauthenticated dashboard access redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Login to your account")).toBeVisible();
});
