import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED: "true",
    },
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "dashboard",
      testMatch: /dashboard-public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "offline-shell",
      testMatch: /offline-shell\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e-reset",
      testMatch: /data-reset\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated-dashboard",
      testIgnore: [
        /smoke\.spec\.ts/,
        /dashboard-public\.spec\.ts/,
        /offline-shell\.spec\.ts/,
        /auth\.setup\.ts/,
        /data-reset\.setup\.ts/,
      ],
      dependencies: ["e2e-reset"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
