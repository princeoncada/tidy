import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

import { authStoragePathForIndex, resolveE2eUserPool } from "./utils/seed";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

test("authenticate dashboard user pool", async ({ browser }) => {
  const pool = resolveE2eUserPool();

  if (pool.length === 0) {
    throw new Error(
      "Authenticated E2E requires a user pool. Set E2E_TEST_EMAIL_1/E2E_TEST_PASSWORD_1 " +
      "(and _2.. for more parallel workers), or the legacy single E2E_TEST_EMAIL/E2E_TEST_PASSWORD " +
      "for serial runs. Copy .env.example to .env.local, set local test credentials, then run " +
      "npm run test:e2e:auth:setup."
    );
  }

  for (let index = 0; index < pool.length; index += 1) {
    const { email, password } = pool[index];
    const page = await browser.newPage();

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Login" }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      await expect(page.getByTestId("app-shell")).toBeVisible();

      const file = authStoragePathForIndex(index);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.context().storageState({ path: file });
    } finally {
      await page.close();
    }
  }
});
