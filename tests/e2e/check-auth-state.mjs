import { existsSync } from "node:fs";

const authFile = "tests/.auth/user.json";

if (!existsSync(authFile)) {
  console.error(
    [
      `Authenticated E2E storage state is missing: ${authFile}`,
      "Run npm run test:e2e:auth:setup after setting E2E_TEST_EMAIL and E2E_TEST_PASSWORD in your local environment.",
      "Normal validation does not require auth. Use npm run test:e2e or npm run test:ci for non-authenticated coverage.",
    ].join("\n")
  );
  process.exit(1);
}
