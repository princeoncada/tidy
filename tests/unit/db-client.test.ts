import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaClient: vi.fn(),
  prismaPg: vi.fn(),
}));

vi.mock("@/app/generated/prisma/client", () => ({
  PrismaClient: function PrismaClient(options: unknown) {
    return mocks.prismaClient(options);
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: function PrismaPg(config: unknown) {
    return mocks.prismaPg(config);
  },
}));

type DbGlobal = typeof globalThis & {
  tidyPrisma?: unknown;
};

describe("database client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    delete (globalThis as DbGlobal).tidyPrisma;
    mocks.prismaClient.mockReset();
    mocks.prismaPg.mockReset();
    mocks.prismaPg.mockImplementation((config) => ({ config }));
    mocks.prismaClient.mockImplementation(({ adapter }) => ({ adapter }));
  });

  afterEach(() => {
    delete (globalThis as DbGlobal).tidyPrisma;
    vi.unstubAllEnvs();
  });

  it("reuses one bounded pool across development module reloads", async () => {
    const first = await import("@/lib/db");
    vi.resetModules();
    const second = await import("@/lib/db");

    expect(second.db).toBe(first.db);
    expect(mocks.prismaPg).toHaveBeenCalledOnce();
    expect(mocks.prismaPg).toHaveBeenCalledWith({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
    });
    expect(mocks.prismaClient).toHaveBeenCalledOnce();
  });
});
