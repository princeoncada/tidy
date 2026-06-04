import { existsSync } from "node:fs";

const authFile = "tests/.auth/user-0.json";

if (!existsSync(authFile)) {
  console.error(
    [
      `Authenticated E2E storage state is missing: ${authFile}`,
      "Run npm run test:e2e:auth:setup after setting the E2E user pool (E2E_TEST_EMAIL_1/E2E_TEST_PASSWORD_1 .. for parallel workers, or legacy E2E_TEST_EMAIL/E2E_TEST_PASSWORD for serial) in your local environment.",
      "Normal validation does not require auth. Use npm run test:e2e or npm run test:ci for non-authenticated coverage.",
    ].join("\n")
  );
  process.exit(1);
}
