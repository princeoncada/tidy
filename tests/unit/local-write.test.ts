import { describe, expect, it, vi } from "vitest";

import type {
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "@/lib/local-db/local-schema";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { TidyLocalDatabase } from "@/lib/local-db/tidy-db";
import {
  commitLocalListCreate,
  commitLocalListDelete,
  commitLocalListItemCompletion,
  commitLocalListItemCreate,
  commitLocalListItemMove,
  commitLocalListItemReorder,
  commitLocalListReorder,
  commitLocalListRename,
  commitLocalListTagChanges,
  commitLocalSelectedView,
  commitLocalTagCreate,
  commitLocalTagDelete,
  commitLocalTagUpdate,
  commitLocalViewCreate,
  commitLocalViewDelete,
  commitLocalViewReorder,
  commitLocalViewUpdate,
} from "@/lib/local-db/local-write";

function createFakeLocalWriteDb() {
  const lists = new Map<string, LocalList>();
  const listItems = new Map<string, LocalListItem>();
  const tags = new Map<string, LocalTag>();
  const views = new Map<string, LocalView>();
  const listTags = new Map<string, LocalListTag>();
  const viewTags = new Map<string, LocalViewTag>();
  const viewLists = new Map<string, LocalViewList>();
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
  const tagTable = {
    get: vi.fn(async (clientId: string) => tags.get(clientId)),
    put: vi.fn(async (tag: LocalTag) => {
      tags.set(tag.clientId, tag);
      return tag.clientId;
    }),
  };
  const viewTable = {
    get: vi.fn(async (clientId: string) => views.get(clientId)),
    put: vi.fn(async (view: LocalView) => {
      views.set(view.clientId, view);
      return view.clientId;
    }),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: string) => ({
        toArray: vi.fn(async () => {
          if (indexName !== "userId") return [];

          return [...views.values()].filter((view) => view.userId === value);
        }),
      })),
    })),
  };
  const listTagTable = {
    get: vi.fn(async (clientId: string) => listTags.get(clientId)),
    put: vi.fn(async (listTag: LocalListTag) => {
      listTags.set(listTag.clientId, listTag);
      return listTag.clientId;
    }),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: [string, string]) => ({
        first: vi.fn(async () => {
          if (indexName !== "[listClientId+tagClientId]") {
            return undefined;
          }

          const [listClientId, tagClientId] = value;
          return [...listTags.values()].find(
            (listTag) =>
              listTag.listClientId === listClientId &&
              listTag.tagClientId === tagClientId,
          );
        }),
      })),
    })),
  };
  const viewTagTable = {
    get: vi.fn(async (clientId: string) => viewTags.get(clientId)),
    put: vi.fn(async (viewTag: LocalViewTag) => {
      viewTags.set(viewTag.clientId, viewTag);
      return viewTag.clientId;
    }),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: string) => ({
        toArray: vi.fn(async () => {
          if (indexName !== "viewClientId") return [];

          return [...viewTags.values()].filter(
            (viewTag) => viewTag.viewClientId === value,
          );
        }),
      })),
    })),
  };
  const viewListTable = {
    get: vi.fn(async (clientId: string) => viewLists.get(clientId)),
    put: vi.fn(async (viewList: LocalViewList) => {
      viewLists.set(viewList.clientId, viewList);
      return viewList.clientId;
    }),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: [string, string]) => ({
        first: vi.fn(async () => {
          if (indexName !== "[viewClientId+listClientId]") {
            return undefined;
          }

          const [viewClientId, listClientId] = value;
          return [...viewLists.values()].find(
            (viewList) =>
              viewList.viewClientId === viewClientId &&
              viewList.listClientId === listClientId,
          );
        }),
      })),
    })),
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
    tags: tagTable,
    views: viewTable,
    listTags: listTagTable,
    viewTags: viewTagTable,
    viewLists: viewListTable,
    outboxOperations: outboxTable,
    transaction,
  } as unknown as TidyLocalDatabase;

  return {
    db,
    lists,
    listItems,
    tags,
    views,
    listTags,
    viewTags,
    viewLists,
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

function createView(overrides: Partial<LocalView> = {}): LocalView {
  return {
    clientId: "view-1",
    serverId: "view-1",
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    name: "Work",
    order: 3,
    type: "CUSTOM",
    isDefault: false,
    matchMode: "ALL",
    ...overrides,
  };
}

function createTag(overrides: Partial<LocalTag> = {}): LocalTag {
  return {
    clientId: "tag-1",
    serverId: "tag-1",
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    name: "Work",
    color: "gray",
    ...overrides,
  };
}

function createListTag(
  overrides: Partial<LocalListTag> = {},
): LocalListTag {
  return {
    clientId: "list-1:tag-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    listClientId: "list-1",
    listServerId: "list-1",
    tagClientId: "tag-1",
    tagServerId: "tag-1",
    ...overrides,
  };
}

function createViewTag(
  overrides: Partial<LocalViewTag> = {},
): LocalViewTag {
  return {
    clientId: "view-1:tag-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    viewClientId: "view-1",
    viewServerId: "view-1",
    tagClientId: "tag-1",
    tagServerId: "tag-1",
    ...overrides,
  };
}

function createViewList(
  overrides: Partial<LocalViewList> = {},
): LocalViewList {
  return {
    clientId: "view-1:list-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "synced",
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    deletedAt: null,
    lastSyncedAt: "2026-06-10T10:00:00.000Z",
    viewClientId: "view-1",
    viewServerId: "view-1",
    listClientId: "list-1",
    listServerId: "list-1",
    order: 3,
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

  it("creates inherited list-tag rows inside the list-create transaction", async () => {
    const { db, lists, listTags, outboxOperations, transaction } =
      createFakeLocalWriteDb();

    await commitLocalListCreate({
      userId: "user-1",
      listId: "list-1",
      name: "Inbox",
      inheritedTagIds: ["tag-1", "tag-2", "tag-1"],
      db,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(lists.has("list-1")).toBe(true);
    expect([...listTags.values()]).toEqual([
      expect.objectContaining({
        clientId: "list-1:tag-1",
        listClientId: "list-1",
        tagClientId: "tag-1",
        syncStatus: "local",
      }),
      expect.objectContaining({
        clientId: "list-1:tag-2",
        listClientId: "list-1",
        tagClientId: "tag-2",
        syncStatus: "local",
      }),
    ]);
    expect(operationsForEntity(outboxOperations, "list", "list-1")).toEqual([
      expect.objectContaining({
        operationType: "create",
        payload: {
          name: "Inbox",
          tagIds: ["tag-1", "tag-2"],
        },
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

  it("reorders view-list rows and appends the exact view-list payload", async () => {
    const { db, viewLists, outboxOperations } = createFakeLocalWriteDb();
    viewLists.set("view-1:list-1", createViewList());
    viewLists.set(
      "view-1:list-2",
      createViewList({
        clientId: "view-1:list-2",
        listClientId: "list-2",
        listServerId: "list-2",
      }),
    );

    await commitLocalListReorder({
      userId: "user-1",
      viewId: "view-1",
      orderedListIds: ["list-2", "list-1"],
      db,
    });

    expect(viewLists.get("view-1:list-2")).toMatchObject({
      order: 0,
      syncStatus: "pending",
    });
    expect(viewLists.get("view-1:list-1")).toMatchObject({
      order: 1,
      syncStatus: "pending",
    });
    expect(
      operationsForEntity(outboxOperations, "viewList", "view-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "reorder",
        payload: {
          viewId: "view-1",
          orderedIds: ["list-2", "list-1"],
        },
      }),
    ]);
  });

  it("reorders local list items and coalesces to the newest state", async () => {
    const { db, listItems, outboxOperations } = createFakeLocalWriteDb();
    listItems.set("item-1", createListItem({ order: 0 }));
    listItems.set(
      "item-2",
      createListItem({ clientId: "item-2", serverId: "item-2", order: 1 }),
    );

    await commitLocalListItemReorder({
      userId: "user-1",
      listId: "list-1",
      orderedItemIds: ["item-2", "item-1"],
      db,
    });
    await commitLocalListItemReorder({
      userId: "user-1",
      listId: "list-1",
      orderedItemIds: ["item-1", "item-2"],
      db,
    });

    expect(listItems.get("item-1")).toMatchObject({
      order: 0,
      syncStatus: "pending",
    });
    expect(listItems.get("item-2")).toMatchObject({
      order: 1,
      syncStatus: "pending",
    });
    expect(
      operationsForEntity(outboxOperations, "listItem", "list-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "reorder",
        payload: {
          listId: "list-1",
          orderedIds: ["item-1", "item-2"],
        },
      }),
    ]);
  });

  it("appends move before destination and source reorders", async () => {
    const { db, listItems, outboxOperations } = createFakeLocalWriteDb();
    listItems.set("item-1", createListItem({ order: 0 }));
    listItems.set(
      "item-2",
      createListItem({ clientId: "item-2", serverId: "item-2", order: 1 }),
    );
    listItems.set(
      "item-3",
      createListItem({
        clientId: "item-3",
        serverId: "item-3",
        listClientId: "list-2",
        listServerId: "list-2",
        order: 0,
      }),
    );

    await commitLocalListItemMove({
      userId: "user-1",
      itemId: "item-1",
      toListId: "list-2",
      order: 1,
      db,
    });
    await commitLocalListItemReorder({
      userId: "user-1",
      listId: "list-2",
      orderedItemIds: ["item-3", "item-1"],
      db,
    });
    await commitLocalListItemReorder({
      userId: "user-1",
      listId: "list-1",
      orderedItemIds: ["item-2"],
      db,
    });

    expect(listItems.get("item-1")).toMatchObject({
      listClientId: "list-2",
      order: 1,
      syncStatus: "pending",
    });
    const operations = [...outboxOperations.values()];

    expect(operations.map((operation) => operation.createdAt)).toEqual(
      [...operations]
        .map((operation) => operation.createdAt)
        .sort((left, right) => left.localeCompare(right)),
    );
    expect(new Set(operations.map((operation) => operation.createdAt)).size).toBe(
      3,
    );
    expect(operations).toEqual([
      expect.objectContaining({
        entityClientId: "item-1",
        operationType: "move",
        payload: { toListClientId: "list-2", order: 1 },
      }),
      expect.objectContaining({
        entityClientId: "list-2",
        operationType: "reorder",
        payload: {
          listId: "list-2",
          orderedIds: ["item-3", "item-1"],
        },
      }),
      expect.objectContaining({
        entityClientId: "list-1",
        operationType: "reorder",
        payload: { listId: "list-1", orderedIds: ["item-2"] },
      }),
    ]);
  });

  it("reorders custom views through one stable coalescing key", async () => {
    const { db, views, outboxOperations } = createFakeLocalWriteDb();
    views.set("view-1", createView({ order: 0 }));
    views.set(
      "view-2",
      createView({
        clientId: "view-2",
        serverId: "view-2",
        name: "Home",
        order: 1,
      }),
    );

    await commitLocalViewReorder({
      userId: "user-1",
      orderedViewIds: ["view-2", "view-1"],
      db,
    });
    await commitLocalViewReorder({
      userId: "user-1",
      orderedViewIds: ["view-1", "view-2"],
      db,
    });

    expect(views.get("view-1")).toMatchObject({
      order: 0,
      syncStatus: "pending",
    });
    expect(
      operationsForEntity(outboxOperations, "view", "view-order"),
    ).toEqual([
      expect.objectContaining({
        operationType: "reorder",
        payload: { orderedIds: ["view-1", "view-2"] },
      }),
    ]);
  });
});

describe("atomic local tag, view, and relationship writes", () => {
  it("creates a local tag and matching create operation", async () => {
    const { db, tags, outboxOperations, transaction } =
      createFakeLocalWriteDb();

    await commitLocalTagCreate({
      userId: "user-1",
      tagId: "tag-1",
      name: "Work",
      color: "blue",
      db,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(tags.get("tag-1")).toMatchObject({
      clientId: "tag-1",
      syncStatus: "local",
      name: "Work",
      color: "blue",
    });
    expect(operationsForEntity(outboxOperations, "tag", "tag-1")).toEqual([
      expect.objectContaining({
        operationType: "create",
        payload: { name: "Work", color: "blue" },
      }),
    ]);
  });

  it("supports name-only and color-only tag updates", async () => {
    const { db, tags, outboxOperations } = createFakeLocalWriteDb();
    tags.set("tag-1", createTag());
    tags.set(
      "tag-2",
      createTag({
        clientId: "tag-2",
        serverId: "tag-2",
        name: "Home",
        color: "red",
      }),
    );

    await commitLocalTagUpdate({
      userId: "user-1",
      tagId: "tag-1",
      name: "Focused work",
      db,
    });
    await commitLocalTagUpdate({
      userId: "user-1",
      tagId: "tag-2",
      color: "green",
      db,
    });

    expect(tags.get("tag-1")).toMatchObject({
      name: "Focused work",
      color: "gray",
      syncStatus: "pending",
    });
    expect(tags.get("tag-2")).toMatchObject({
      name: "Home",
      color: "green",
      syncStatus: "pending",
    });
    expect(operationsForEntity(outboxOperations, "tag", "tag-1")).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: { name: "Focused work" },
      }),
    ]);
    expect(operationsForEntity(outboxOperations, "tag", "tag-2")).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: { color: "green" },
      }),
    ]);
  });

  it("tombstones a tag and emits a delete operation", async () => {
    const { db, tags, outboxOperations } = createFakeLocalWriteDb();
    tags.set("tag-1", createTag());

    await commitLocalTagDelete({
      userId: "user-1",
      tagId: "tag-1",
      db,
    });

    expect(tags.get("tag-1")).toMatchObject({
      syncStatus: "pending",
      deletedAt: expect.any(String),
    });
    expect(operationsForEntity(outboxOperations, "tag", "tag-1")).toEqual([
      expect.objectContaining({
        operationType: "delete",
        payload: {},
      }),
    ]);
  });

  it("adds a list-tag row and emits an attach operation", async () => {
    const { db, listTags, outboxOperations } = createFakeLocalWriteDb();

    await commitLocalListTagChanges({
      userId: "user-1",
      listId: "list-1",
      operations: [{ tagId: "tag-1", action: "add" }],
      db,
    });

    expect(listTags.get("list-1:tag-1")).toMatchObject({
      syncStatus: "local",
      deletedAt: null,
      listClientId: "list-1",
      tagClientId: "tag-1",
    });
    expect(
      operationsForEntity(outboxOperations, "listTag", "list-1:tag-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "attach",
        payload: { listId: "list-1", tagId: "tag-1" },
      }),
    ]);
  });

  it("tombstones a list-tag row and emits a detach operation", async () => {
    const { db, listTags, outboxOperations } = createFakeLocalWriteDb();
    listTags.set("list-1:tag-1", createListTag());

    await commitLocalListTagChanges({
      userId: "user-1",
      listId: "list-1",
      operations: [{ tagId: "tag-1", action: "remove" }],
      db,
    });

    expect(listTags.get("list-1:tag-1")).toMatchObject({
      syncStatus: "pending",
      deletedAt: expect.any(String),
    });
    expect(
      operationsForEntity(outboxOperations, "listTag", "list-1:tag-1"),
    ).toEqual([
      expect.objectContaining({
        operationType: "detach",
        payload: { listId: "list-1", tagId: "tag-1" },
      }),
    ]);
  });

  it("applies mixed list-tag changes in one transaction", async () => {
    const { db, listTags, outboxOperations, transaction } =
      createFakeLocalWriteDb();
    listTags.set(
      "list-1:tag-2",
      createListTag({
        clientId: "list-1:tag-2",
        tagClientId: "tag-2",
        tagServerId: "tag-2",
      }),
    );

    await commitLocalListTagChanges({
      userId: "user-1",
      listId: "list-1",
      operations: [
        { tagId: "tag-1", action: "add" },
        { tagId: "tag-2", action: "remove" },
      ],
      db,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(listTags.get("list-1:tag-1")?.deletedAt).toBeNull();
    expect(listTags.get("list-1:tag-2")?.deletedAt).toEqual(
      expect.any(String),
    );
    expect(
      operationsForEntity(outboxOperations, "listTag", "list-1:tag-1")[0],
    ).toMatchObject({ operationType: "attach" });
    expect(
      operationsForEntity(outboxOperations, "listTag", "list-1:tag-2")[0],
    ).toMatchObject({ operationType: "detach" });
  });

  it("creates a selected custom view with view-tag rows and one view operation", async () => {
    const { db, views, viewTags, outboxOperations } =
      createFakeLocalWriteDb();
    views.set(
      "all-lists",
      createView({
        clientId: "all-lists",
        serverId: "all-lists",
        name: "All Lists",
        order: 0,
        type: "ALL_LISTS",
        isDefault: true,
      }),
    );
    views.set("view-old", createView({ clientId: "view-old", order: 2 }));

    await commitLocalViewCreate({
      userId: "user-1",
      viewId: "view-new",
      name: "Priority",
      tagIds: ["tag-1", "tag-2"],
      matchMode: "ANY",
      db,
    });

    expect(views.get("all-lists")?.isDefault).toBe(false);
    expect(views.get("view-new")).toMatchObject({
      name: "Priority",
      order: -1,
      type: "CUSTOM",
      isDefault: true,
      matchMode: "ANY",
      syncStatus: "local",
    });
    expect(viewTags.get("view-new:tag-1")).toMatchObject({
      viewClientId: "view-new",
      tagClientId: "tag-1",
      deletedAt: null,
    });
    expect(viewTags.get("view-new:tag-2")).toMatchObject({
      viewClientId: "view-new",
      tagClientId: "tag-2",
      deletedAt: null,
    });
    expect(operationsForEntity(outboxOperations, "view", "view-new")).toEqual([
      expect.objectContaining({
        operationType: "create",
        payload: {
          name: "Priority",
          tagIds: ["tag-1", "tag-2"],
          matchMode: "ANY",
        },
      }),
    ]);
  });

  it("combines view name and tag changes into one update operation", async () => {
    const { db, views, viewTags, outboxOperations } =
      createFakeLocalWriteDb();
    views.set("view-1", createView());
    viewTags.set("view-1:tag-1", createViewTag());

    await commitLocalViewUpdate({
      userId: "user-1",
      viewId: "view-1",
      name: "Focused",
      tagIds: ["tag-2"],
      db,
    });

    expect(views.get("view-1")).toMatchObject({
      name: "Focused",
      syncStatus: "pending",
    });
    expect(viewTags.get("view-1:tag-1")?.deletedAt).toEqual(
      expect.any(String),
    );
    expect(viewTags.get("view-1:tag-2")).toMatchObject({
      tagClientId: "tag-2",
      deletedAt: null,
      syncStatus: "local",
    });
    expect(operationsForEntity(outboxOperations, "view", "view-1")).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: {
          name: "Focused",
          tagIds: ["tag-2"],
        },
      }),
    ]);
  });

  it("tombstones a default custom view and restores All Lists selection", async () => {
    const { db, views, outboxOperations } = createFakeLocalWriteDb();
    views.set(
      "all-lists",
      createView({
        clientId: "all-lists",
        serverId: "all-lists",
        name: "All Lists",
        type: "ALL_LISTS",
        isDefault: false,
      }),
    );
    views.set("view-1", createView({ isDefault: true }));

    await commitLocalViewDelete({
      userId: "user-1",
      viewId: "view-1",
      db,
    });

    expect(views.get("view-1")).toMatchObject({
      syncStatus: "pending",
      deletedAt: expect.any(String),
    });
    expect(views.get("all-lists")?.isDefault).toBe(true);
    expect(operationsForEntity(outboxOperations, "view", "view-1")).toEqual([
      expect.objectContaining({
        operationType: "delete",
        payload: {},
      }),
    ]);
  });

  it("updates selected-view flags and emits one stable metadata operation", async () => {
    const { db, views, outboxOperations } = createFakeLocalWriteDb();
    views.set(
      "all-lists",
      createView({
        clientId: "all-lists",
        serverId: "all-lists",
        name: "All Lists",
        type: "ALL_LISTS",
        isDefault: true,
      }),
    );
    views.set("view-1", createView({ isDefault: false }));

    await commitLocalSelectedView({
      userId: "user-1",
      viewId: "view-1",
      db,
    });

    expect(views.get("all-lists")?.isDefault).toBe(false);
    expect(views.get("view-1")?.isDefault).toBe(true);
    expect(
      operationsForEntity(outboxOperations, "metadata", "selected-view"),
    ).toEqual([
      expect.objectContaining({
        operationType: "update",
        payload: { selectedViewId: "view-1" },
      }),
    ]);
  });
});
