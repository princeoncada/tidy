import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  list: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateManyAndReturn: vi.fn(), deleteMany: vi.fn() },
  tag: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateManyAndReturn: vi.fn(), deleteMany: vi.fn() },
  view: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findFirstOrThrow: vi.fn(), findUniqueOrThrow: vi.fn() },
  viewTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  viewList: { findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  listTag: { findMany: vi.fn(), upsert: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/trpc/routers/viewHelpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/trpc/routers/viewHelpers")>()),
  ensureAllListsView: vi.fn(),
  ensureDefaultView: vi.fn(),
  setSelectedView: vi.fn(),
  recomputeCustomView: vi.fn(),
  recomputeCustomViewsForIds: vi.fn(),
  recomputeCustomViewsForTags: vi.fn(),
  getAffectedCustomViewIdsForTags: vi.fn(),
  getAffectedCustomViewsForTags: vi.fn(),
  getAffectedCustomViewsByIds: vi.fn(),
}));

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import * as viewHelpers from "@/trpc/routers/viewHelpers";

const createCaller = createCallerFactory(appRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER_B = "22222222-2222-4222-8222-222222222222";
const LIST_FOREIGN = "44444444-4444-4444-8444-444444444444";
const LIST_OWNED = "33333333-3333-4333-8333-333333333333";
const TAG_FOREIGN = "55555555-5555-4555-8555-555555555555";
const TAG_OWNED = "77777777-7777-4777-8777-777777777777";
const VIEW_FOREIGN = "88888888-8888-4888-8888-888888888888";
const NEW_LIST = "99999999-9999-4999-8999-999999999999";
const NEW_VIEW = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const helpers = vi.mocked(viewHelpers);

function authedCaller(userId: string) {
  return createCaller({
    user: { id: userId },
    supabase: {},
  } as unknown as TestTRPCContext);
}

function expectTrpcCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(TRPCError);
  expect(error).toMatchObject({ code });
}

beforeEach(() => {
  vi.clearAllMocks();

  dbMock.$transaction.mockImplementation(async (cb) => cb(dbMock));
  helpers.ensureAllListsView.mockResolvedValue({ id: "all-lists-view" } as never);
  helpers.ensureDefaultView.mockResolvedValue({ id: "default-view" } as never);
  helpers.setSelectedView.mockResolvedValue({ id: "selected-view" } as never);
  helpers.recomputeCustomView.mockResolvedValue(undefined);
  helpers.recomputeCustomViewsForIds.mockResolvedValue(undefined);
  helpers.recomputeCustomViewsForTags.mockResolvedValue(undefined);
  helpers.getAffectedCustomViewIdsForTags.mockResolvedValue([]);
  helpers.getAffectedCustomViewsForTags.mockResolvedValue([]);
  helpers.getAffectedCustomViewsByIds.mockResolvedValue([]);
});

describe("router ownership sweep", () => {
  it("createList rejects a foreign target viewId", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce(null);
    dbMock.view.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).list.createList({
        id: NEW_LIST,
        name: "x",
        viewId: VIEW_FOREIGN,
      });
      throw new Error("Expected createList to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.view.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VIEW_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("addToList rejects a foreign list", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce(null);
    dbMock.tag.findFirst.mockResolvedValueOnce({ id: TAG_OWNED });

    try {
      await authedCaller(USER_B).tag.addToList({
        listId: LIST_FOREIGN,
        tagId: TAG_OWNED,
      });
      throw new Error("Expected addToList to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.list.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: LIST_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("addToList rejects a foreign tag", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce({ id: LIST_OWNED });
    dbMock.tag.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).tag.addToList({
        listId: LIST_OWNED,
        tagId: TAG_FOREIGN,
      });
      throw new Error("Expected addToList to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.tag.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TAG_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("removeFromList scopes deletion to the caller", async () => {
    dbMock.listTag.deleteMany.mockResolvedValueOnce({ count: 0 });
    dbMock.listTag.findMany.mockResolvedValueOnce([]);

    await expect(
      authedCaller(USER_B).tag.removeFromList({
        listId: LIST_FOREIGN,
        tagId: TAG_FOREIGN,
      })
    ).resolves.toMatchObject({ detached: false });

    expect(dbMock.listTag.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          list: { userId: USER_B },
          tag: { userId: USER_B },
        }),
      })
    );
  });

  it("applyListTagChanges rejects a foreign list", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce(null);
    dbMock.tag.findMany.mockResolvedValueOnce([{ id: TAG_OWNED }]);

    try {
      await authedCaller(USER_B).tag.applyListTagChanges({
        listId: LIST_FOREIGN,
        operations: [{ tagId: TAG_OWNED, action: "add" }],
      });
      throw new Error("Expected applyListTagChanges to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.list.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: LIST_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("applyListTagChanges rejects a foreign add-tag", async () => {
    dbMock.list.findFirst.mockResolvedValueOnce({ id: LIST_OWNED });
    dbMock.tag.findMany.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).tag.applyListTagChanges({
        listId: LIST_OWNED,
        operations: [{ tagId: TAG_FOREIGN, action: "add" }],
      });
      throw new Error("Expected applyListTagChanges to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [TAG_FOREIGN] },
          userId: USER_B,
        }),
      })
    );
  });

  it("delete scopes deletion by userId", async () => {
    dbMock.tag.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      authedCaller(USER_B).tag.delete({ id: TAG_FOREIGN })
    ).resolves.toMatchObject({ deleted: false });

    expect(dbMock.tag.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TAG_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("create rejects foreign tags", async () => {
    dbMock.tag.findMany.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).view.create({
        id: NEW_VIEW,
        name: "x",
        tagIds: [TAG_FOREIGN],
      });
      throw new Error("Expected view.create to reject");
    } catch (error) {
      expectTrpcCode(error, "FORBIDDEN");
    }

    expect(dbMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [TAG_FOREIGN] },
          userId: USER_B,
        }),
      })
    );
  });

  it("updateFilter rejects foreign tags", async () => {
    dbMock.tag.findMany.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).view.updateFilter({
        id: VIEW_FOREIGN,
        tagIds: [TAG_FOREIGN],
      });
      throw new Error("Expected updateFilter to reject");
    } catch (error) {
      expectTrpcCode(error, "FORBIDDEN");
    }

    expect(dbMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [TAG_FOREIGN] },
          userId: USER_B,
        }),
      })
    );
  });

  it("updateFilter rejects a foreign view", async () => {
    dbMock.tag.findMany.mockResolvedValueOnce([{ id: TAG_OWNED }]);
    dbMock.view.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).view.updateFilter({
        id: VIEW_FOREIGN,
        tagIds: [TAG_OWNED],
      });
      throw new Error("Expected updateFilter to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.view.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VIEW_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("delete rejects a foreign view", async () => {
    dbMock.view.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).view.delete({ id: VIEW_FOREIGN });
      throw new Error("Expected view.delete to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.view.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VIEW_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("reorderViews rejects foreign views", async () => {
    dbMock.view.findMany.mockResolvedValueOnce([]);

    try {
      await authedCaller(USER_B).view.reorderViews({
        views: [{ id: VIEW_FOREIGN, order: 0 }],
      });
      throw new Error("Expected reorderViews to reject");
    } catch (error) {
      expectTrpcCode(error, "FORBIDDEN");
    }

    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
    expect(dbMock.view.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [VIEW_FOREIGN] },
          userId: USER_B,
        }),
      })
    );
  });

  it("reorderViewLists rejects a foreign view", async () => {
    dbMock.view.findFirst.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).view.reorderViewLists({
        viewId: VIEW_FOREIGN,
        lists: [{ id: LIST_OWNED, order: 0 }],
      });
      throw new Error("Expected reorderViewLists to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
    expect(dbMock.view.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VIEW_FOREIGN,
          userId: USER_B,
        }),
      })
    );
  });

  it("saveSelectedView rejects a foreign view", async () => {
    helpers.setSelectedView.mockResolvedValueOnce(null);

    try {
      await authedCaller(USER_B).view.saveSelectedView({ viewId: VIEW_FOREIGN });
      throw new Error("Expected saveSelectedView to reject");
    } catch (error) {
      expectTrpcCode(error, "NOT_FOUND");
    }

    expect(helpers.setSelectedView).toHaveBeenCalledWith(USER_B, VIEW_FOREIGN);
  });
});
