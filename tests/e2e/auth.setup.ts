import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

const authFile = path.join("tests", ".auth", "user.json");

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

test("authenticate dashboard user", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Authenticated E2E requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD. " +
      "Copy .env.example to .env.local, set local test credentials, then run npm run test:e2e:auth:setup."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByTestId("app-shell")).toBeVisible();

  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
