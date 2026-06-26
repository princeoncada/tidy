import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  mutationLedgerEntry: {
    findMany: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { historyRouter } from "@/trpc/routers/historyRouter";

const createCaller = createCallerFactory(historyRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER = "11111111-1111-4111-8111-111111111111";
const ROWS = [
  {
    id: "ledger-1",
    name: "createList",
    affectedListIds: ["22222222-2222-4222-8222-222222222222"],
    createdAt: new Date("2026-06-26T01:02:03.000Z"),
  },
];

function caller() {
  return createCaller({
    user: { id: USER },
    supabase: {},
  } as unknown as TestTRPCContext);
}

describe("history router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.mutationLedgerEntry.findMany.mockResolvedValue(ROWS);
  });

  it("lists the caller's mutation history with the default limit", async () => {
    await expect(caller().listMutationHistory({})).resolves.toBe(ROWS);

    expect(dbMock.mutationLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { userId: USER },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        affectedListIds: true,
        createdAt: true,
      },
    });
  });

  it("uses a provided limit", async () => {
    await expect(
      caller().listMutationHistory({ limit: 12 }),
    ).resolves.toBe(ROWS);

    expect(dbMock.mutationLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { userId: USER },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        affectedListIds: true,
        createdAt: true,
      },
    });
  });
});
