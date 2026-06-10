import { describe, expect, it, vi } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { SyncBatchOperationDecision } from "@/lib/sync/sync-batch-contract";
import { applySyncOperations } from "@/lib/sync/server-apply";

type AcceptedDecision = Extract<SyncBatchOperationDecision, { accepted: true }>;
type ApplyDatabase = NonNullable<
  Parameters<typeof applySyncOperations>[0]["db"]
>;

function createOperation(
  overrides: Partial<LocalOutboxOperation> = {},
): LocalOutboxOperation {
  return {
    operationId: "op-1",
    userId: "user-1",
    entityType: "list",
    entityClientId: "list-1",
    entityServerId: "list-1",
    operationType: "update",
    payload: { name: "Inbox" },
    status: "syncing",
    retryCount: 0,
    errorMessage: null,
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    lastAttemptedAt: "2026-06-10T10:00:00.000Z",
    idempotencyKey: "op-1-key",
    ...overrides,
  };
}

function accepted(
  overrides: Partial<LocalOutboxOperation> = {},
): AcceptedDecision {
  const operation = createOperation(overrides);
  return {
    operationId: operation.operationId,
    idempotencyKey: operation.idempotencyKey,
    accepted: true,
    operation,
  };
}

function createTx() {
  return {
    list: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    listItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    tag: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    listTag: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    viewTag: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    view: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      delete: vi.fn(),
    },
    viewList: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      createMany: vi.fn(async () => ({ count: 1 })),
      upsert: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    $executeRaw: vi.fn(async () => 1),
  };
}

function createDb(tx: ReturnType<typeof createTx>): ApplyDatabase {
  return {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)),
  } as unknown as ApplyDatabase;
}

describe("server sync apply", () => {
  it("updates lists with an id-and-user scoped write", async () => {
    const tx = createTx();
    tx.list.findUnique.mockResolvedValue({
      userId: "user-1",
      name: "Old",
    });
    const database = createDb(tx);

    await expect(
      applySyncOperations({
        userId: "user-1",
        decisions: [accepted()],
        db: database,
      }),
    ).resolves.toEqual([{
      operationId: "op-1",
      status: "applied",
      errorMessage: null,
    }]);

    expect(tx.list.updateMany).toHaveBeenCalledWith({
      where: { id: "list-1", userId: "user-1" },
      data: { name: "Inbox" },
    });
  });

  it("treats an existing owned create as already applied", async () => {
    const tx = createTx();
    tx.list.findUnique.mockResolvedValue({
      id: "list-1",
      userId: "user-1",
    });
    tx.view.findFirst.mockResolvedValue({
      id: "all-view",
      isDefault: true,
    });
    const database = createDb(tx);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        operationType: "create",
        entityServerId: null,
      })],
      db: database,
    });

    expect(results[0]).toMatchObject({ status: "already-applied" });
    expect(tx.list.create).not.toHaveBeenCalled();
  });

  it("treats an absent owned delete target as already applied", async () => {
    const tx = createTx();
    tx.list.findUnique.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        operationType: "delete",
        payload: { deletedAt: "2026-06-10T10:00:00.000Z" },
      })],
      db: createDb(tx),
    });

    expect(results[0]).toMatchObject({ status: "already-applied" });
    expect(tx.list.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects foreign-owned list writes without issuing an update", async () => {
    const tx = createTx();
    tx.list.findUnique.mockResolvedValue({
      userId: "user-2",
      name: "Foreign",
    });

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted()],
      db: createDb(tx),
    });

    expect(results[0]).toEqual({
      operationId: "op-1",
      status: "rejected",
      errorMessage: "List update target belongs to another user.",
    });
    expect(tx.list.updateMany).not.toHaveBeenCalled();
  });

  it("creates an item only after checking the owned parent list", async () => {
    const tx = createTx();
    tx.listItem.findUnique.mockResolvedValue(null);
    tx.list.findFirst.mockResolvedValue({ id: "list-1" });
    tx.listItem.findFirst.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "listItem",
        entityClientId: "item-1",
        operationType: "create",
        payload: { name: "Task", listId: "list-1" },
      })],
      db: createDb(tx),
    });

    expect(tx.list.findFirst).toHaveBeenCalledWith({
      where: { id: "list-1", userId: "user-1" },
      select: { id: true },
    });
    expect(tx.listItem.create).toHaveBeenCalledWith({
      data: {
        id: "item-1",
        name: "Task",
        listId: "list-1",
        order: 0,
        completed: false,
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("moves an item only after checking source and target ownership", async () => {
    const tx = createTx();
    tx.listItem.findUnique.mockResolvedValue({
      listId: "list-1",
      order: 2,
      parentList: { userId: "user-1" },
    });
    tx.list.findFirst.mockResolvedValue({ id: "list-2" });

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "listItem",
        entityClientId: "item-1",
        operationType: "move",
        payload: { toListClientId: "list-2", order: 0 },
      })],
      db: createDb(tx),
    });

    expect(tx.listItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        parentList: { userId: "user-1" },
      },
      data: {
        listId: "list-2",
        order: 0,
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("uses one owned view-list batch write for list reorder", async () => {
    const tx = createTx();
    tx.view.findFirst.mockResolvedValue({ id: "view-1" });
    tx.viewList.findMany.mockResolvedValue([
      { listId: "list-1", order: 3 },
      { listId: "list-2", order: 4 },
    ]);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        operationType: "reorder",
        payload: {
          viewId: "view-1",
          orderedIds: ["list-2", "list-1"],
        },
      })],
      db: createDb(tx),
    });

    expect(tx.view.findFirst).toHaveBeenCalledWith({
      where: { id: "view-1", userId: "user-1" },
      select: { id: true },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("creates a tag with the authenticated user id after checking name uniqueness", async () => {
    const tx = createTx();
    tx.tag.findUnique.mockResolvedValue(null);
    tx.tag.findFirst.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "tag",
        entityClientId: "tag-1",
        operationType: "create",
        payload: { name: "Errands", color: "blue" },
      })],
      db: createDb(tx),
    });

    expect(tx.tag.create).toHaveBeenCalledWith({
      data: {
        id: "tag-1",
        name: "Errands",
        color: "blue",
        userId: "user-1",
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("applies list-tag attach idempotently after checking both owners", async () => {
    const tx = createTx();
    tx.list.findFirst.mockResolvedValue({ id: "list-1" });
    tx.tag.findFirst.mockResolvedValue({ id: "tag-1" });
    tx.listTag.findUnique.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "listTag",
        entityClientId: "list-1:tag-1",
        operationType: "attach",
        payload: { listId: "list-1", tagId: "tag-1" },
      })],
      db: createDb(tx),
    });

    expect(tx.listTag.upsert).toHaveBeenCalledWith({
      where: {
        listId_tagId: {
          listId: "list-1",
          tagId: "tag-1",
        },
      },
      update: {},
      create: {
        listId: "list-1",
        tagId: "tag-1",
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("keeps durable write results applied when post-commit recompute fails", async () => {
    const tx = createTx();
    tx.list.findFirst.mockResolvedValue({ id: "list-1" });
    tx.tag.findFirst.mockResolvedValue({ id: "tag-1" });
    tx.listTag.findUnique.mockResolvedValue(null);
    tx.view.findMany.mockRejectedValue(new Error("recompute unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "listTag",
        entityClientId: "list-1:tag-1",
        operationType: "attach",
        payload: { listId: "list-1", tagId: "tag-1" },
      })],
      db: createDb(tx),
    });

    expect(results[0]).toMatchObject({ status: "applied" });
    expect(consoleError).toHaveBeenCalledWith(
      "Sync post-commit custom-view recompute failed",
      expect.objectContaining({
        userId: "user-1",
        tagIds: ["tag-1"],
      }),
    );
    consoleError.mockRestore();
  });

  it("applies view-tag attach only for an owned custom view and tag", async () => {
    const tx = createTx();
    tx.view.findFirst
      .mockResolvedValueOnce({ id: "view-1" })
      .mockResolvedValueOnce(null);
    tx.tag.findFirst.mockResolvedValue({ id: "tag-1" });
    tx.viewTag.findUnique.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "viewTag",
        entityClientId: "view-1:tag-1",
        operationType: "attach",
        payload: { viewId: "view-1", tagId: "tag-1" },
      })],
      db: createDb(tx),
    });

    expect(tx.view.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: "view-1",
        userId: "user-1",
        type: "CUSTOM",
      },
      select: { id: true },
    });
    expect(tx.viewTag.upsert).toHaveBeenCalledWith({
      where: {
        viewId_tagId: {
          viewId: "view-1",
          tagId: "tag-1",
        },
      },
      update: {},
      create: {
        viewId: "view-1",
        tagId: "tag-1",
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("creates a custom view with owned tags and defers recompute until after commit", async () => {
    const tx = createTx();
    tx.view.findUnique.mockResolvedValue(null);
    tx.view.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "all-view",
        type: "ALL_LISTS",
        isDefault: true,
      })
      .mockResolvedValueOnce({ id: "all-view" })
      .mockResolvedValueOnce({ order: 0 })
      .mockResolvedValueOnce(null);
    tx.tag.findMany.mockResolvedValue([{ id: "tag-1" }]);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "view",
        entityClientId: "view-1",
        operationType: "create",
        payload: { name: "Errands", tagIds: ["tag-1"] },
      })],
      db: createDb(tx),
    });

    expect(tx.view.create).toHaveBeenCalledWith({
      data: {
        id: "view-1",
        name: "Errands",
        userId: "user-1",
        order: -1,
        type: "CUSTOM",
        matchMode: "ALL",
        isDefault: true,
        viewTags: {
          createMany: {
            data: [{ tagId: "tag-1" }],
            skipDuplicates: true,
          },
        },
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("attaches a list to a view only after checking both owners", async () => {
    const tx = createTx();
    tx.list.findFirst.mockResolvedValue({ id: "list-1" });
    tx.view.findFirst.mockResolvedValue({ id: "view-1" });
    tx.viewList.findUnique.mockResolvedValue(null);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "viewList",
        entityClientId: "view-1:list-1",
        operationType: "attach",
        payload: { viewId: "view-1", listId: "list-1", order: 0 },
      })],
      db: createDb(tx),
    });

    expect(tx.viewList.upsert).toHaveBeenCalledWith({
      where: {
        viewId_listId: {
          viewId: "view-1",
          listId: "list-1",
        },
      },
      update: { order: 0 },
      create: {
        viewId: "view-1",
        listId: "list-1",
        order: 0,
      },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("persists selected-view metadata through the owned view helper path", async () => {
    const tx = createTx();
    tx.view.findFirst
      .mockResolvedValueOnce({ id: "view-1", isDefault: false })
      .mockResolvedValueOnce({ id: "view-1", isDefault: false });
    tx.view.update.mockResolvedValue({ id: "view-1", isDefault: true });

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        payload: { selectedViewId: "view-1" },
      })],
      db: createDb(tx),
    });

    expect(tx.view.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isDefault: true,
        id: { not: "view-1" },
      },
      data: { isDefault: false },
    });
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("uses one batch SQL write for an owned view reorder", async () => {
    const tx = createTx();
    tx.view.findMany.mockResolvedValue([
      { id: "view-1", order: 4 },
      { id: "view-2", order: 5 },
    ]);

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        entityType: "view",
        operationType: "reorder",
        payload: { orderedIds: ["view-2", "view-1"] },
      })],
      db: createDb(tx),
    });

    expect(tx.view.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["view-2", "view-1"] },
        userId: "user-1",
        type: "CUSTOM",
      },
      select: { id: true, order: true },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ status: "applied" });
  });

  it("returns an explicit rejection for accepted combinations without semantics", async () => {
    const tx = createTx();

    const results = await applySyncOperations({
      userId: "user-1",
      decisions: [accepted({
        operationType: "move",
        payload: { targetClientId: "list-2" },
      })],
      db: createDb(tx),
    });

    expect(results).toEqual([{
      operationId: "op-1",
      status: "rejected",
      errorMessage: "No server semantics for list move/upsert.",
    }]);
  });

  it("returns an explicit outcome for every contract-accepted matrix combination", async () => {
    const tx = createTx();
    const combinations: Array<[
      LocalOutboxOperation["entityType"],
      LocalOutboxOperation["operationType"],
    ]> = [
      ["view", "create"],
      ["view", "update"],
      ["view", "delete"],
      ["view", "reorder"],
      ["view", "upsert"],
      ["list", "create"],
      ["list", "update"],
      ["list", "delete"],
      ["list", "reorder"],
      ["list", "move"],
      ["list", "upsert"],
      ["listItem", "create"],
      ["listItem", "update"],
      ["listItem", "delete"],
      ["listItem", "reorder"],
      ["listItem", "move"],
      ["listItem", "upsert"],
      ["tag", "create"],
      ["tag", "update"],
      ["tag", "delete"],
      ["tag", "upsert"],
      ["viewTag", "attach"],
      ["viewTag", "detach"],
      ["viewTag", "upsert"],
      ["viewTag", "delete"],
      ["listTag", "attach"],
      ["listTag", "detach"],
      ["listTag", "upsert"],
      ["listTag", "delete"],
      ["viewList", "attach"],
      ["viewList", "detach"],
      ["viewList", "reorder"],
      ["viewList", "move"],
      ["viewList", "upsert"],
      ["viewList", "delete"],
      ["metadata", "update"],
      ["metadata", "upsert"],
    ];
    const decisions = combinations.map(([entityType, operationType], index) =>
      accepted({
        operationId: `matrix-${index}`,
        idempotencyKey: `matrix-${index}-key`,
        entityType,
        entityClientId: `entity-${index}`,
        operationType,
        payload:
          operationType === "delete"
            ? { deletedAt: "2026-06-10T10:00:00.000Z" }
            : {},
      }));

    const results = await applySyncOperations({
      userId: "user-1",
      decisions,
      db: createDb(tx),
    });

    expect(results).toHaveLength(combinations.length);
    expect(results.every((applyResult) =>
      ["applied", "already-applied", "rejected"].includes(
        applyResult.status,
      ))).toBe(true);
    expect(results.every((applyResult) =>
      applyResult.status !== "applied" || applyResult.errorMessage === null
    )).toBe(true);
  });

  it("propagates transaction failure so the route can fail every accepted operation atomically", async () => {
    const database = {
      $transaction: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    } as unknown as ApplyDatabase;

    await expect(
      applySyncOperations({
        userId: "user-1",
        decisions: [accepted(), accepted({
          operationId: "op-2",
          entityClientId: "list-2",
          idempotencyKey: "op-2-key",
        })],
        db: database,
      }),
    ).rejects.toThrow("database unavailable");
  });
});
