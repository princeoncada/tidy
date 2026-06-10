import { describe, expect, it, vi } from "vitest";

import type {
  LocalList,
  LocalListItem,
} from "@/lib/local-db/local-schema";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { TidyLocalDatabase } from "@/lib/local-db/tidy-db";
import {
  commitLocalListCreate,
  commitLocalListDelete,
  commitLocalListItemCompletion,
  commitLocalListItemCreate,
  commitLocalListRename,
} from "@/lib/local-db/local-write";

function createFakeLocalWriteDb() {
  const lists = new Map<string, LocalList>();
  const listItems = new Map<string, LocalListItem>();
  const outboxOperations = new Map<string, LocalOutboxOperation>();

  const listTable = {
    get: vi.fn(async (clientId: string) => lists.get(clientId)),
    put: vi.fn(async (list: LocalList) => {
      lists.set(list.clientId, list);
      return list.clientId;
    }),
  };
  const listItemTable = {
    get: vi.fn(async (clientId: string) => listItems.get(clientId)),
    put: vi.fn(async (item: LocalListItem) => {
      listItems.set(item.clientId, item);
      return item.clientId;
    }),
  };
  const outboxTable = {
    get: vi.fn(async (operationId: string) => outboxOperations.get(operationId)),
    put: vi.fn(async (operation: LocalOutboxOperation) => {
      outboxOperations.set(operation.operationId, operation);
      return operation.operationId;
    }),
    bulkDelete: vi.fn(async (operationIds: string[]) => {
      for (const operationId of operationIds) {
        outboxOperations.delete(operationId);
      }
    }),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: [string, string]) => ({
        sortBy: vi.fn(async (fieldName: string) => {
          if (indexName !== "[entityType+entityClientId]") {
            return [];
          }

          const [entityType, entityClientId] = value;
          return [...outboxOperations.values()]
            .filter(
              (operation) =>
                operation.entityType === entityType &&
                operation.entityClientId === entityClientId,
            )
            .sort((left, right) =>
              String(left[fieldName as keyof LocalOutboxOperation]).localeCompare(
                String(right[fieldName as keyof LocalOutboxOperation]),
              ),
            );
        }),
      })),
    })),
  };
  const transaction = vi.fn(
    async (
      _mode: string,
      _tables: unknown[],
      scope: () => Promise<void>,
    ) => scope(),
  );
  const db = {
    lists: listTable,
    listItems: listItemTable,
    outboxOperations: outboxTable,
    transaction,
  } as unknown as TidyLocalDatabase;

  return {
    db,
    lists,
    listItems,
    outboxOperations,
    transaction,
  };
}

function createList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    clientId: "list-1",
    serverId: "list-1",
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    name: "Inbox",
    ...overrides,
  };
}

function createListItem(
  overrides: Partial<LocalListItem> = {},
): LocalListItem {
  return {
    clientId: "item-1",
    serverId: "item-1",
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    name: "Buy milk",
    completed: false,
    order: 3,
    notes: null,
    listClientId: "list-1",
    listServerId: "list-1",
    ...overrides,
  };
}

function operationsForEntity(
  operations: Map<string, LocalOutboxOperation>,
  entityType: LocalOutboxOperation["entityType"],
  entityClientId: string,
): LocalOutboxOperation[] {
  return [...operations.values()].filter(
    (operation) =>
      operation.entityType === entityType &&
      operation.entityClientId === entityClientId,
  );
}

describe("atomic local list and item writes", () => {
  it("creates a local list and its create outbox operation together", async () => {
    const { db, lists, outboxOperations, transaction } =
      createFakeLocalWriteDb();

    await commitLocalListCreate({
      userId: "user-1",
      listId: "list-1",
      name: "Inbox",
      db,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(lists.get("list-1")).toMatchObject({
      clientId: "list-1",
      userId: "user-1",
      syncStatus: "local",
      name: "Inbox",
    });
    expect(operationsForEntity(outboxOperations, "list", "list-1")).toEqual([
      expect.objectContaining({
        operationType: "create",
        payload: { name: "Inbox" },
        status: "pending",
      }),
    ]);
  });

  it("creates a local list item and its exact server payload", async () => {
    const { db, listItems, outboxOperations, transaction } =
      createFakeLocalWriteDb();

    await commitLocalListItemCreate({
      userId: "user-1",
      itemId: "item-1",
      listId: "list-1",
      name: "Buy milk",
      order: 4,
      db,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(listItems.get("item-1")).toMatchObject({
      clientId: "item-1",
      syncStatus: "local",
      completed: false,
      order: 4,
      listClientId: "list-1",
    });
    expect(
      operationsForEntity(outboxOperations, "listItem", "item-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "create",
        payload: {
          name: "Buy milk",
          listId: "list-1",
          order: 4,
        },
      }),
    ]);
  });

  it("updates completion locally and appends the matching update payload", async () => {
    const { db, listItems, outboxOperations } = createFakeLocalWriteDb();
    listItems.set("item-1", createListItem());

    await commitLocalListItemCompletion({
      userId: "user-1",
      itemId: "item-1",
      completed: true,
      db,
    });

    expect(listItems.get("item-1")).toMatchObject({
      completed: true,
      syncStatus: "pending",
    });
    expect(
      operationsForEntity(outboxOperations, "listItem", "item-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: { completed: true },
      }),
    ]);
  });

  it("coalesces consecutive list renames to the newest pending update", async () => {
    const { db, lists, outboxOperations } = createFakeLocalWriteDb();
    lists.set("list-1", createList());

    await commitLocalListRename({
      userId: "user-1",
      listId: "list-1",
      name: "Inbox draft",
      db,
    });
    await commitLocalListRename({
      userId: "user-1",
      listId: "list-1",
      name: "Inbox final",
      db,
    });

    expect(operationsForEntity(outboxOperations, "list", "list-1")).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: { name: "Inbox final" },
        status: "pending",
      }),
    ]);
  });

  it("cancels an unsynced create followed by delete", async () => {
    const { db, outboxOperations } = createFakeLocalWriteDb();

    await commitLocalListCreate({
      userId: "user-1",
      listId: "list-1",
      name: "Temporary",
      db,
    });
    await commitLocalListDelete({
      userId: "user-1",
      listId: "list-1",
      db,
    });

    expect(operationsForEntity(outboxOperations, "list", "list-1")).toEqual(
      [],
    );
  });

  it("tombstones an existing list and appends a delete operation", async () => {
    const { db, lists, outboxOperations } = createFakeLocalWriteDb();
    lists.set("list-1", createList());

    await commitLocalListDelete({
      userId: "user-1",
      listId: "list-1",
      db,
    });

    expect(lists.get("list-1")).toMatchObject({
      syncStatus: "pending",
      deletedAt: expect.any(String),
    });
    expect(operationsForEntity(outboxOperations, "list", "list-1")).toEqual([
      expect.objectContaining({
        operationType: "delete",
        payload: {},
      }),
    ]);
  });
});
