import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForDb = globalThis as typeof globalThis & {
  tidyPrisma?: PrismaClient;
};

function createDbClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    idleTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

export const db = globalForDb.tidyPrisma ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.tidyPrisma = db;
}
