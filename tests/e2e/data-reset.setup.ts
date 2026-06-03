import { test } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

test("reset leftover e2e data", async () => {
  const { db } = await import("@/lib/db");
  const e2eNameScope = { startsWith: "e2e-" };

  try {
    await db.$transaction([
      db.list.deleteMany({ where: { name: e2eNameScope } }),
      db.tag.deleteMany({ where: { name: e2eNameScope } }),
      db.view.deleteMany({ where: { name: e2eNameScope } }),
    ]);
  } finally {
    await db.$disconnect();
  }
});
