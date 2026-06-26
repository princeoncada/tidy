import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  mutationLedgerEntry: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

const serverReadMocks = vi.hoisted(() => ({
  readReplicacheViewsForUser: vi.fn(),
  readReplicacheAllListsSnapshotForUser: vi.fn(),
  readReplicacheAccessibleListsForUser: vi.fn(),
  readTagsForUser: vi.fn(),
}));

const serverApplyMocks = vi.hoisted(() => ({
  applyAcceptedSyncOperationsWithinTransaction: vi.fn(),
  createSyncPostCommitEffects: vi.fn(),
  runSyncPostCommitEffects: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
  getUsersWithListAccess: vi.fn(),
}));

const pokeMocks = vi.hoisted(() => ({
  pokeUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/dashboard/server-read", () => serverReadMocks);
vi.mock("@/lib/sync/server-apply", () => serverApplyMocks);
vi.mock("@/lib/sync/permissions", () => permissionMocks);
vi.mock("@/lib/realtime/poke-server", () => pokeMocks);

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { revertRouter } from "@/trpc/routers/revertRouter";

const createCaller = createCallerFactory(revertRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER = "11111111-1111-4111-8111-111111111111";
const ENTRY_CREATE = "22222222-2222-4222-8222-222222222222";
const ENTRY_RENAME = "33333333-3333-4333-8333-333333333333";
const LIST = "44444444-4444-4444-8444-444444444444";
const VIEW = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-06-26T01:00:00.000Z");
const renamedAt = new Date("2026-06-26T01:01:00.000Z");

function caller() {
  return createCaller({
    user: { id: USER },
    supabase: {},
  } as unknown as TestTRPCContext);
}

function createLedgerEntry() {
  return {
    id: ENTRY_CREATE,
    clientId: "client-1",
    mutationId: 1,
    name: "createList",
    args: {
      id: LIST,
      userId: USER,
      name: "Inbox",
      allListsViewId: VIEW,
      order: "a0",
      now: "2026-06-26T01:00:00.000Z",
    },
    createdAt,
  };
}

function renameLedgerEntry() {
  return {
    id: ENTRY_RENAME,
    clientId: "client-1",
    mutationId: 2,
    name: "renameList",
    args: {
      id: LIST,
      name: "Renamed",
      now: "2026-06-26T01:01:00.000Z",
    },
    createdAt: renamedAt,
  };
}

function mockCurrentDashboard() {
  serverReadMocks.readReplicacheViewsForUser.mockResolvedValue([{
    id: VIEW,
    name: "All Lists",
    order: 0,
    orderKey: "a0",
    userId: USER,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    createdAt,
    updatedAt: createdAt,
    viewLists: [{ listId: LIST, order: 0, orderKey: "a0" }],
    viewTags: [],
  }]);
  serverReadMocks.readReplicacheAllListsSnapshotForUser.mockResolvedValue({
    view: {},
    lists: [{
      id: LIST,
      userId: USER,
      name: "Renamed",
      workspaceId: null,
      createdAt,
      updatedAt: renamedAt,
      listItems: [],
      listTags: [],
    }],
  });
  serverReadMocks.readReplicacheAccessibleListsForUser.mockResolvedValue([]);
  serverReadMocks.readTagsForUser.mockResolvedValue([]);
}

describe("revert router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverApplyMocks.createSyncPostCommitEffects.mockReturnValue({
      tagIds: new Set(),
      viewIds: new Set(),
    });
    serverApplyMocks.applyAcceptedSyncOperationsWithinTransaction
      .mockResolvedValue([{ operationId: "op-1", status: "applied" }]);
    serverApplyMocks.runSyncPostCommitEffects.mockResolvedValue(undefined);
    permissionMocks.getUsersWithListAccess.mockResolvedValue(new Set(["user-2"]));
    pokeMocks.pokeUser.mockResolvedValue(undefined);
    dbMock.$transaction.mockImplementation(async (callback) => callback({}));
    mockCurrentDashboard();
  });

  it("reverts to an earlier entry with a non-empty plan and post-commit effects", async () => {
    dbMock.mutationLedgerEntry.findFirst.mockResolvedValue(createLedgerEntry());
    dbMock.mutationLedgerEntry.findMany.mockResolvedValue([
      createLedgerEntry(),
      renameLedgerEntry(),
    ]);

    await expect(
      caller().revertToLedgerEntry({ entryId: ENTRY_CREATE }),
    ).resolves.toEqual({ applied: 1 });

    expect(serverApplyMocks.applyAcceptedSyncOperationsWithinTransaction)
      .toHaveBeenCalledWith(expect.objectContaining({
        userId: USER,
        decisions: [
          expect.objectContaining({
            operation: expect.objectContaining({
              entityType: "list",
              operationType: "update",
              entityClientId: LIST,
              payload: { name: "Inbox" },
            }),
          }),
        ],
      }));
    expect(serverApplyMocks.runSyncPostCommitEffects)
      .toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));
    expect(permissionMocks.getUsersWithListAccess)
      .toHaveBeenCalledWith(dbMock, [LIST]);
    expect(pokeMocks.pokeUser).toHaveBeenCalledWith(USER);
    expect(pokeMocks.pokeUser).toHaveBeenCalledWith("user-2");
  });

  it("throws NOT_FOUND for a missing or foreign entry", async () => {
    dbMock.mutationLedgerEntry.findFirst.mockResolvedValue(null);

    await expect(
      caller().revertToLedgerEntry({ entryId: ENTRY_CREATE }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(dbMock.mutationLedgerEntry.findMany).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an empty no-op when reverting to the latest entry", async () => {
    dbMock.mutationLedgerEntry.findFirst.mockResolvedValue(renameLedgerEntry());
    dbMock.mutationLedgerEntry.findMany.mockResolvedValue([
      createLedgerEntry(),
      renameLedgerEntry(),
    ]);

    await expect(
      caller().revertToLedgerEntry({ entryId: ENTRY_RENAME }),
    ).resolves.toEqual({ applied: 0 });

    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(serverApplyMocks.runSyncPostCommitEffects).not.toHaveBeenCalled();
    expect(pokeMocks.pokeUser).not.toHaveBeenCalled();
  });
});
