import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  list: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateManyAndReturn: vi.fn(),
    deleteMany: vi.fn(),
  },
  listItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateManyAndReturn: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  tag: {
    updateManyAndReturn: vi.fn(),
  },
  view: {
    findMany: vi.fn(),
    updateManyAndReturn: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const createCaller = createCallerFactory(appRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const LIST_A = "33333333-3333-4333-8333-333333333333";
const LIST_FOREIGN = "44444444-4444-4444-8444-444444444444";
const ITEM_A = "55555555-5555-4555-8555-555555555555";
const ITEM_B = "66666666-6666-4666-8666-666666666666";
const TAG_A = "77777777-7777-4777-8777-777777777777";
const VIEW_A = "88888888-8888-4888-8888-888888888888";

function authedCaller(userId: string) {
  return createCaller({
    user: { id: userId },
    supabase: {},
  } as unknown as TestTRPCContext);
}

function anonCaller() {
  return createCaller({
    user: null,
    supabase: {},
  } as unknown as TestTRPCContext);
}

function expectTrpcCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(TRPCError);
  expect(error).toMatchObject({ code });
}

beforeEach(() => {
  vi.clearAllMocks();

  dbMock.list.findFirst.mockResolvedValue({ id: LIST_A });
  dbMock.list.findMany.mockResolvedValue([]);
  dbMock.list.updateManyAndReturn.mockResolvedValue([
    { id: LIST_A, userId: USER_A, name: "Renamed list" },
  ]);
  dbMock.list.deleteMany.mockResolvedValue({ count: 1 });

  dbMock.listItem.findMany.mockResolvedValue([{ id: ITEM_A }]);
  dbMock.listItem.findFirst.mockResolvedValue({ order: 0 });
  dbMock.listItem.update.mockResolvedValue({
    id: ITEM_A,
    name: "Renamed item",
    listId: LIST_A,
    completed: false,
  });
  dbMock.listItem.updateManyAndReturn.mockResolvedValue([
    {
      id: ITEM_A,
      name: "Renamed item",
      listId: LIST_A,
      completed: false,
    },
  ]);
  dbMock.listItem.deleteMany.mockResolvedValue({ count: 1 });
  dbMock.listItem.create.mockResolvedValue({
    id: ITEM_B,
    name: "New item",
    listId: LIST_A,
    completed: false,
    order: -1,
  });

  dbMock.tag.updateManyAndReturn.mockResolvedValue([
    { id: TAG_A, userId: USER_A, name: "Renamed tag" },
  ]);
  dbMock.view.findMany.mockResolvedValue([{ id: VIEW_A }]);
  dbMock.view.updateManyAndReturn.mockResolvedValue([
    { id: VIEW_A, userId: USER_A, name: "Renamed view" },
  ]);
  dbMock.$executeRaw.mockResolvedValue(1);
  dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) =>
    callback(dbMock)
  );
});

describe("router ownership baseline", () => {
  it("rejects unauthenticated list item access at the protected layer", async () => {
    await expect(
      anonCaller().listItem.getListItems({ listId: LIST_A })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("getListItems scopes reads to lists owned by the caller", async () => {
    dbMock.listItem.findMany.mockResolvedValueOnce([]);

    await expect(
      authedCaller(USER_B).listItem.getListItems({ listId: LIST_A })
    ).resolves.toEqual([]);

    const findManyArgs = dbMock.listItem.findMany.mock.calls[0][0];
    expect(findManyArgs.where).toEqual({
      listId: LIST_A,
      parentList: { userId: USER_B },
    });
  });

  it("renameListItem rejects items the caller does not own", async () => {
    dbMock.listItem.updateManyAndReturn.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).listItem.renameListItem({ id: ITEM_A, name: "stolen" });
      throw new Error("Expected renameListItem to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.listItem.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ITEM_A,
          parentList: { userId: USER_B },
        }),
        data: { name: "stolen" },
      })
    );
  });

  it("renameListItem updates items the caller owns", async () => {
    await expect(
      authedCaller(USER_A).listItem.renameListItem({ id: ITEM_A, name: "Renamed item" })
    ).resolves.toMatchObject({ id: ITEM_A });
  });

  it("deleteListItem only deletes items the caller owns", async () => {
    dbMock.listItem.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      authedCaller(USER_B).listItem.deleteListItem({ id: ITEM_A })
    ).resolves.toEqual({ deleted: false });

    expect(dbMock.listItem.deleteMany).toHaveBeenCalledWith({
      where: {
        id: ITEM_A,
        parentList: { userId: USER_B },
      },
    });
  });

  it("deleteListItem deletes items the caller owns", async () => {
    await expect(
      authedCaller(USER_A).listItem.deleteListItem({ id: ITEM_A })
    ).resolves.toEqual({ deleted: true });
  });

  it("setCompletionListItem rejects items the caller does not own", async () => {
    dbMock.listItem.updateManyAndReturn.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).listItem.setCompletionListItem({
        id: ITEM_A,
        completed: true,
      });
      throw new Error("Expected setCompletionListItem to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.listItem.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ITEM_A,
          parentList: { userId: USER_B },
        }),
        data: { completed: true },
      })
    );
  });

  it("setCompletionListItem updates items the caller owns", async () => {
    await expect(
      authedCaller(USER_A).listItem.setCompletionListItem({ id: ITEM_A, completed: true })
    ).resolves.toMatchObject({ id: ITEM_A });
  });

  it("rejects createListItem for a foreign parent list", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).listItem.createListItem({
        id: ITEM_B,
        name: "Blocked item",
        listId: LIST_A,
      });
      throw new Error("Expected createListItem to reject");
    } catch (error) {
      expectTrpcCode(error, "FORBIDDEN");
    }
  });

  it("rejects reorderListItems when any item is not owned", async () => {
    dbMock.listItem.findMany.mockResolvedValueOnce([{ id: ITEM_A }]);

    try {
      await authedCaller(USER_B).listItem.reorderListItems({
        items: [
          { id: ITEM_A, listId: LIST_A, order: 0 },
          { id: ITEM_B, listId: LIST_A, order: 1 },
        ],
      });
      throw new Error("Expected reorderListItems to reject");
    } catch (error) {
      expectTrpcCode(error, "FORBIDDEN");
    }
  });

  it("resolves reorderListItems empty input without ownership reads or writes", async () => {
    await expect(
      authedCaller(USER_B).listItem.reorderListItems({ items: [] })
    ).resolves.toEqual({ success: true });

    expect(dbMock.listItem.findMany).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("UNSAFE: target list not validated - 1.6.2 reorderListItems writes a foreign target listId", async () => {
    // UNSAFE: target list not validated - 1.6.2
    dbMock.listItem.findMany.mockResolvedValueOnce([{ id: ITEM_A }]);

    await expect(
      authedCaller(USER_B).listItem.reorderListItems({
        items: [{ id: ITEM_A, listId: LIST_FOREIGN, order: 0 }],
      })
    ).resolves.toEqual({ success: true });

    expect(dbMock.$executeRaw).toHaveBeenCalled();
    expect(dbMock.list.findMany).not.toHaveBeenCalled();
  });

  it("scopes list.renameList by userId for foreign ids", async () => {
    dbMock.list.updateManyAndReturn.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).list.renameList({
        id: LIST_A,
        name: "Blocked list",
      });
      throw new Error("Expected renameList to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.list.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: LIST_A,
          userId: USER_B,
        }),
      })
    );
  });

  it("scopes list.deleteList by userId for foreign ids", async () => {
    dbMock.list.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      authedCaller(USER_B).list.deleteList({ listId: LIST_A })
    ).resolves.toEqual({ id: LIST_A });

    expect(dbMock.list.deleteMany).toHaveBeenCalledWith({
      where: {
        id: LIST_A,
        userId: USER_B,
      },
    });
  });

  it("scopes tag.update by userId for foreign ids", async () => {
    dbMock.tag.updateManyAndReturn.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).tag.update({
        id: TAG_A,
        name: "Blocked tag",
      });
      throw new Error("Expected tag.update to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.tag.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TAG_A,
          userId: USER_B,
        }),
      })
    );
  });

  it("scopes view.rename by userId for foreign ids", async () => {
    dbMock.view.updateManyAndReturn.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).view.rename({
        id: VIEW_A,
        name: "Blocked view",
      });
      throw new Error("Expected view.rename to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.view.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VIEW_A,
          userId: USER_B,
        }),
      })
    );
  });

  it("resolves view.reorderViews empty input without a raw write", async () => {
    await expect(
      authedCaller(USER_B).view.reorderViews({ views: [] })
    ).resolves.toEqual({ success: true });

    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });
});
