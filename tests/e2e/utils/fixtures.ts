import { test as base, expect } from "@playwright/test";
import { existsSync } from "node:fs";

import { authStoragePathForIndex } from "./seed";

export const test = base.extend({
  storageState: async ({}, use) => {
    const index = test.info().parallelIndex;
    const file = authStoragePathForIndex(index);

    if (!existsSync(file)) {
      throw new Error(
        `Missing auth storage for parallel worker ${index}: ${file}. ` +
        `Provision E2E_TEST_EMAIL_${index + 1}/E2E_TEST_PASSWORD_${index + 1} ` +
        `(worker 0 may use the legacy single E2E_TEST_EMAIL/E2E_TEST_PASSWORD), ` +
        `then run npm run test:e2e:auth:setup. ` +
        `If your user pool is smaller than the worker count, lower --workers.`
      );
    }

    await use(file);
  },
});

export { expect };
