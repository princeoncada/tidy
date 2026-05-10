import { expect, test } from "@playwright/test";
import path from "node:path";

const authFile = path.join("tests", ".auth", "user.json");

test("authenticate dashboard user", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Authenticated E2E requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD. " +
      "Run smoke tests with npm run test:e2e, or provide credentials and run npm run test:e2e:auth."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await page.context().storageState({ path: authFile });
});
