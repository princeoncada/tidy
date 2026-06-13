import { describe, expect, it } from "vitest";

import type {
  DashboardSnapshot,
  ViewCacheItem,
  ViewsCache,
} from "@/lib/dashboard-cache";
import { applyPendingMovementOverlay } from "@/lib/local-db/local-movement";
import {
  applyPendingOutboxOverlay,
  applyPendingViewOverlay,
  isOutboxOperationServerConfirmed,
  outboxOperationsSignature,
  readActiveOutboxOperationsForUser,
  readPendingOutboxOperationsForUser,
  relinquishConfirmedOperations,
} from "@/lib/local-db/local-overlay";
import { createOutboxOperation } from "@/lib/local-db/local-repositories";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { TidyLocalDatabase } from "@/lib/local-db/tidy-db";

const timestamp = "2026-06-12T10:00:00.000Z";

function tag(id: string, name = id, color = "gray" as const) {
  return {
    id,
    name,
    color,
    userId: "user-1",
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
  };
}

function view(
  overrides: Partial<ViewCacheItem> = {},
): ViewCacheItem {
  return {
    id: "view-all",
    name: "All Lists",
    userId: "user-1",
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
    viewTags: [],
    viewLists: [],
    ...overrides,
  };
}

function snapshot(): DashboardSnapshot {
  return {
    view: view({
      viewLists: [
        { listId: "list-a", order: 0 },
        { listId: "list-b", order: 1 },
      ],
    }),
    lists: [
      {
        id: "list-a",
        userId: "user-1",
        name: "List A",
        order: 0,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
        listTags: [
          {
            listId: "list-a",
            tagId: "tag-a",
            tag: tag("tag-a", "Focus"),
          },
        ],
        listItems: [
          {
            id: "item-a",
            name: "Item A",
            completed: false,
            notes: null,
            listId: "list-a",
            order: 0,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          },
          {
            id: "item-b",
            name: "Item B",
            completed: false,
            notes: null,
            listId: "list-a",
            order: 1,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          },
        ],
      },
      {
        id: "list-b",
        userId: "user-1",
        name: "List B",
        order: 1,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
        listTags: [],
        listItems: [],
      },
    ],
  } as DashboardSnapshot;
}

function viewsSnapshot(): ViewsCache {
  return [
    view(),
    view({
      id: "view-a",
      name: "View A",
      type: "CUSTOM",
      isDefault: false,
      matchMode: "ANY",
      order: 1,
      viewTags: [
        {
          viewId: "view-a",
          tagId: "tag-a",
          tag: tag("tag-a", "Focus"),
        },
      ],
    }),
    view({
      id: "view-b",
      name: "View B",
      type: "CUSTOM",
      isDefault: true,
      order: 2,
    }),
  ];
}

function operation(
  overrides: Partial<LocalOutboxOperation> &
    Pick<
      LocalOutboxOperation,
      "entityType" | "entityClientId" | "operationType"
    >,
): LocalOutboxOperation {
  return createOutboxOperation({
    operationId: overrides.operationId ?? crypto.randomUUID(),
    userId: overrides.userId ?? "user-1",
    entityType: overrides.entityType,
    entityClientId: overrides.entityClientId,
    entityServerId: overrides.entityServerId ?? null,
    operationType: overrides.operationType,
    payload: overrides.payload ?? {},
    status: overrides.status ?? "pending",
    retryCount: overrides.retryCount ?? 0,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? timestamp,
    lastAttemptedAt: overrides.lastAttemptedAt ?? null,
    idempotencyKey:
      overrides.idempotencyKey ?? overrides.operationId ?? crypto.randomUUID(),
  });
}

function fakeOutboxDb(operations: LocalOutboxOperation[]) {
  return {
    outboxOperations: {
      where: () => ({
        equals: (userId: string) => ({
          sortBy: async () =>
            operations
              .filter((candidate) => candidate.userId === userId)
              .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt),
              ),
        }),
      }),
    },
  } as unknown as TidyLocalDatabase;
}

describe("readPendingOutboxOperationsForUser", () => {
  it("returns all pending categories in created order for one user", async () => {
    const operations = [
      operation({
        operationId: "synced",
        entityType: "tag",
        entityClientId: "tag-synced",
        operationType: "create",
        status: "synced",
        createdAt: "2026-06-12T10:00:00.001Z",
      }),
      operation({
        operationId: "failed-view",
        entityType: "view",
        entityClientId: "view-a",
        operationType: "update",
        status: "failed",
        createdAt: "2026-06-12T10:00:00.003Z",
      }),
      operation({
        operationId: "pending-list",
        entityType: "list",
        entityClientId: "list-a",
        operationType: "update",
        createdAt: "2026-06-12T10:00:00.002Z",
      }),
      operation({
        operationId: "syncing-tag",
        entityType: "listTag",
        entityClientId: "list-a:tag-a",
        operationType: "attach",
        status: "syncing",
        createdAt: "2026-06-12T10:00:00.004Z",
      }),
      operation({
        operationId: "pending-item",
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "update",
        createdAt: "2026-06-12T10:00:00.005Z",
      }),
      operation({
        operationId: "pending-tag",
        entityType: "tag",
        entityClientId: "tag-a",
        operationType: "update",
        createdAt: "2026-06-12T10:00:00.006Z",
      }),
      operation({
        operationId: "pending-view-tag",
        entityType: "viewTag",
        entityClientId: "view-a:tag-a",
        operationType: "attach",
        createdAt: "2026-06-12T10:00:00.007Z",
      }),
      operation({
        operationId: "pending-view-list",
        entityType: "viewList",
        entityClientId: "view-a",
        operationType: "reorder",
        createdAt: "2026-06-12T10:00:00.008Z",
      }),
      operation({
        operationId: "pending-metadata",
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        createdAt: "2026-06-12T10:00:00.009Z",
      }),
      operation({
        operationId: "discarded",
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "delete",
        status: "discarded",
        createdAt: "2026-06-12T10:00:00.010Z",
      }),
      operation({
        operationId: "other-user",
        userId: "user-2",
        entityType: "list",
        entityClientId: "list-other",
        operationType: "create",
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    ];

    const result = await readPendingOutboxOperationsForUser(
      "user-1",
      fakeOutboxDb(operations),
    );

    expect(result.map((candidate) => candidate.operationId)).toEqual([
      "pending-list",
      "failed-view",
      "syncing-tag",
      "pending-item",
      "pending-tag",
      "pending-view-tag",
      "pending-view-list",
      "pending-metadata",
    ]);
    expect(new Set(result.map((candidate) => candidate.entityType))).toEqual(
      new Set([
        "list",
        "view",
        "listTag",
        "listItem",
        "tag",
        "viewTag",
        "viewList",
        "metadata",
      ]),
    );
  });
});

describe("readActiveOutboxOperationsForUser", () => {
  it("returns active statuses in created order for one user", async () => {
    const operations = [
      operation({
        operationId: "discarded",
        entityType: "list",
        entityClientId: "list-discarded",
        operationType: "delete",
        status: "discarded",
        createdAt: "2026-06-12T10:00:00.006Z",
      }),
      operation({
        operationId: "synced",
        entityType: "list",
        entityClientId: "list-a",
        operationType: "create",
        status: "synced",
        createdAt: "2026-06-12T10:00:00.004Z",
      }),
      operation({
        operationId: "failed",
        entityType: "tag",
        entityClientId: "tag-a",
        operationType: "update",
        status: "failed",
        createdAt: "2026-06-12T10:00:00.003Z",
      }),
      operation({
        operationId: "pending",
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "update",
        status: "pending",
        createdAt: "2026-06-12T10:00:00.001Z",
      }),
      operation({
        operationId: "syncing",
        entityType: "listTag",
        entityClientId: "list-a:tag-a",
        operationType: "attach",
        status: "syncing",
        createdAt: "2026-06-12T10:00:00.002Z",
      }),
      operation({
        operationId: "other-user",
        userId: "user-2",
        entityType: "view",
        entityClientId: "view-other",
        operationType: "create",
        status: "pending",
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    ];

    const result = await readActiveOutboxOperationsForUser(
      "user-1",
      fakeOutboxDb(operations),
    );

    expect(result.map((candidate) => candidate.operationId)).toEqual([
      "pending",
      "syncing",
      "failed",
      "synced",
    ]);
  });
});

describe("applyPendingOutboxOverlay", () => {
  it("keeps a pending list create visible", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "list",
        entityClientId: "list-local",
        operationType: "create",
        payload: { name: "Local List" },
      }),
    ]);

    expect(result.lists[0]).toMatchObject({
      id: "list-local",
      name: "Local List",
      userId: "optimistic",
      order: -1,
      isOptimistic: true,
      listItems: [],
      listTags: [],
    });
  });

  it("replays list rename and delete", () => {
    const renamed = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "list",
        entityClientId: "list-a",
        operationType: "update",
        payload: { name: "Renamed List" },
      }),
    ]);
    const deleted = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "list",
        entityClientId: "list-a",
        operationType: "delete",
      }),
    ]);

    expect(renamed.lists.find((list) => list.id === "list-a")?.name).toBe(
      "Renamed List",
    );
    expect(deleted.lists.map((list) => list.id)).toEqual(["list-b"]);
  });

  it("replays list-item create", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listItem",
        entityClientId: "item-local",
        operationType: "create",
        payload: { name: "Local Item", listId: "list-b", order: 2 },
      }),
    ]);

    expect(result.lists[1].listItems[0]).toMatchObject({
      id: "item-local",
      name: "Local Item",
      completed: false,
      listId: "list-b",
      order: 2,
      isOptimistic: true,
    });
  });

  it("replays list-item rename and completion updates", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "update",
        payload: { name: "Renamed Item" },
      }),
      operation({
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "update",
        payload: { completed: true },
      }),
    ]);

    expect(result.lists[0].listItems[0]).toMatchObject({
      name: "Renamed Item",
      completed: true,
    });
  });

  it("replays list-item delete", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "delete",
      }),
    ]);

    expect(result.lists[0].listItems.map((item) => item.id)).toEqual([
      "item-b",
    ]);
  });

  it("replays list-tag attach using existing tag metadata", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listTag",
        entityClientId: "list-b:tag-a",
        operationType: "attach",
        payload: { listId: "list-b", tagId: "tag-a" },
      }),
    ]);

    expect(result.lists[1].listTags[0]).toEqual({
      listId: "list-b",
      tagId: "tag-a",
      tag: expect.objectContaining({ id: "tag-a", name: "Focus" }),
    });
  });

  it("synthesizes minimal tag metadata when attaching an unknown tag", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listTag",
        entityClientId: "list-b:tag-local",
        operationType: "attach",
        payload: { listId: "list-b", tagId: "tag-local" },
      }),
    ]);

    expect(result.lists[1].listTags[0].tag).toMatchObject({
      id: "tag-local",
      name: "tag-local",
      color: "gray",
      userId: "optimistic",
    });
  });

  it("replays list-tag detach", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "listTag",
        entityClientId: "list-a:tag-a",
        operationType: "detach",
        payload: { listId: "list-a", tagId: "tag-a" },
      }),
    ]);

    expect(result.lists[0].listTags).toEqual([]);
  });

  it("replays tag metadata updates across list tags", () => {
    const result = applyPendingOutboxOverlay(snapshot(), [
      operation({
        entityType: "tag",
        entityClientId: "tag-a",
        operationType: "update",
        payload: { name: "Urgent", color: "red" },
      }),
    ]);

    expect(result.lists[0].listTags[0].tag).toMatchObject({
      name: "Urgent",
      color: "red",
    });
  });

  it("strips a deleted tag from every list", () => {
    const source = snapshot();
    source.lists[1].listTags = [
      { listId: "list-b", tagId: "tag-a", tag: tag("tag-a", "Focus") },
    ];

    const result = applyPendingOutboxOverlay(source, [
      operation({
        entityType: "tag",
        entityClientId: "tag-a",
        operationType: "delete",
      }),
    ]);

    expect(result.lists.every((list) => list.listTags.length === 0)).toBe(true);
  });

  it("delegates move and reorder behavior to the movement overlay", () => {
    const movementOperations = [
      operation({
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "move",
        payload: { toListClientId: "list-b", order: 0 },
        createdAt: "2026-06-12T10:00:00.001Z",
      }),
      operation({
        entityType: "listItem",
        entityClientId: "list-b",
        operationType: "reorder",
        payload: { listId: "list-b", orderedIds: ["item-a"] },
        createdAt: "2026-06-12T10:00:00.002Z",
      }),
      operation({
        entityType: "listItem",
        entityClientId: "list-a",
        operationType: "reorder",
        payload: { listId: "list-a", orderedIds: ["item-b"] },
        createdAt: "2026-06-12T10:00:00.003Z",
      }),
      operation({
        entityType: "viewList",
        entityClientId: "view-all",
        operationType: "reorder",
        payload: {
          viewId: "view-all",
          orderedIds: ["list-b", "list-a"],
        },
        createdAt: "2026-06-12T10:00:00.004Z",
      }),
    ];

    expect(
      applyPendingOutboxOverlay(snapshot(), movementOperations),
    ).toEqual(applyPendingMovementOverlay(snapshot(), movementOperations));
  });

  it("does not mutate the input and skips malformed payloads", () => {
    const source = snapshot();
    const original = structuredClone(source);
    const result = applyPendingOutboxOverlay(source, [
      operation({
        entityType: "list",
        entityClientId: "list-a",
        operationType: "update",
        payload: { name: 42 },
      }),
      operation({
        entityType: "listItem",
        entityClientId: "item-a",
        operationType: "create",
        payload: { name: "Missing placement" },
      }),
      operation({
        entityType: "listTag",
        entityClientId: "bad-relation",
        operationType: "attach",
        payload: { listId: null, tagId: [] },
      }),
    ]);

    expect(source).toEqual(original);
    expect(result).toEqual(original);
    expect(result).not.toBe(source);
  });
});

describe("isOutboxOperationServerConfirmed", () => {
  it("confirms list create, update, and delete effects", () => {
    const allLists = snapshot();

    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-a",
          operationType: "create",
          payload: { name: "List A" },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-local",
          operationType: "create",
          payload: { name: "Local List" },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-a",
          operationType: "create",
          payload: { name: "List A" },
        }),
        { allLists: null },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-a",
          operationType: "update",
          payload: { name: "List A" },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-a",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-a",
          operationType: "update",
          payload: { name: "Other" },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "list",
          entityClientId: "list-local",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(true);
  });

  it("confirms list-item create, update, and delete effects", () => {
    const allLists = snapshot();

    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-a",
          operationType: "create",
          payload: { name: "Item A", listId: "list-a", order: 0 },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-local",
          operationType: "create",
          payload: { name: "Local Item", listId: "list-a", order: 2 },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-a",
          operationType: "update",
          payload: { name: "Item A", completed: false },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-a",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-a",
          operationType: "update",
          payload: { completed: true },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listItem",
          entityClientId: "item-local",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(true);
  });

  it("confirms list-tag attach and detach effects", () => {
    const allLists = snapshot();

    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listTag",
          entityClientId: "list-a:tag-a",
          operationType: "attach",
          payload: { listId: "list-a", tagId: "tag-a" },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listTag",
          entityClientId: "list-b:tag-a",
          operationType: "attach",
          payload: { listId: "list-b", tagId: "tag-a" },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listTag",
          entityClientId: "list-b:tag-a",
          operationType: "detach",
          payload: { listId: "list-b", tagId: "tag-a" },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "listTag",
          entityClientId: "list-missing:tag-a",
          operationType: "detach",
          payload: { listId: "list-missing", tagId: "tag-a" },
        }),
        { allLists },
      ),
    ).toBe(true);
  });

  it("confirms tag update and delete effects", () => {
    const allLists = snapshot();

    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "tag",
          entityClientId: "tag-a",
          operationType: "update",
          payload: { name: "Focus", color: "gray" },
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "tag",
          entityClientId: "tag-a",
          operationType: "update",
          payload: { color: "red" },
        }),
        { allLists },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "tag",
          entityClientId: "tag-missing",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "tag",
          entityClientId: "tag-a",
          operationType: "delete",
        }),
        { allLists },
      ),
    ).toBe(false);
  });

  it("confirms view and selected-view metadata effects", () => {
    const views = viewsSnapshot();

    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-a",
          operationType: "create",
          payload: { name: "View A", tagIds: ["tag-a"] },
        }),
        { views },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-local",
          operationType: "create",
          payload: { name: "Local View", tagIds: [] },
        }),
        { views },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-a",
          operationType: "update",
          payload: {
            name: "View A",
            matchMode: "ANY",
            tagIds: ["tag-a"],
          },
        }),
        { views },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-a",
          operationType: "update",
          payload: { tagIds: ["tag-b"] },
        }),
        { views },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-missing",
          operationType: "delete",
        }),
        { views },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "view",
          entityClientId: "view-a",
          operationType: "delete",
        }),
        { views },
      ),
    ).toBe(false);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "metadata",
          entityClientId: "selected-view",
          operationType: "update",
          payload: { selectedViewId: "view-b" },
        }),
        { views },
      ),
    ).toBe(true);
    expect(
      isOutboxOperationServerConfirmed(
        operation({
          entityType: "metadata",
          entityClientId: "selected-view",
          operationType: "update",
          payload: { selectedViewId: "view-a" },
        }),
        { views },
      ),
    ).toBe(false);
  });
});

describe("relinquishConfirmedOperations", () => {
  it("relinquishes correctness operations only after server confirmation", () => {
    const operations = [
      operation({
        operationId: "synced-confirmed",
        entityType: "list",
        entityClientId: "list-a",
        operationType: "create",
        payload: { name: "List A" },
        status: "synced",
      }),
      operation({
        operationId: "synced-unconfirmed",
        entityType: "list",
        entityClientId: "list-local",
        operationType: "create",
        payload: { name: "Local List" },
        status: "synced",
      }),
      operation({
        operationId: "pending-unconfirmed",
        entityType: "list",
        entityClientId: "list-pending",
        operationType: "create",
        payload: { name: "Pending List" },
        status: "pending",
      }),
      operation({
        operationId: "syncing-unconfirmed",
        entityType: "list",
        entityClientId: "list-syncing",
        operationType: "create",
        payload: { name: "Syncing List" },
        status: "syncing",
      }),
      operation({
        operationId: "failed-unconfirmed",
        entityType: "list",
        entityClientId: "list-failed",
        operationType: "create",
        payload: { name: "Failed List" },
        status: "failed",
      }),
    ];

    expect(
      relinquishConfirmedOperations(operations, {
        allLists: snapshot(),
      }).map((candidate) => candidate.operationId),
    ).toEqual([
      "synced-unconfirmed",
      "pending-unconfirmed",
      "syncing-unconfirmed",
      "failed-unconfirmed",
    ]);
  });

  it("keeps a synced detach until removal is confirmed without re-adding it", () => {
    const detach = operation({
      entityType: "listTag",
      entityClientId: "list-a:tag-a",
      operationType: "detach",
      payload: { listId: "list-a", tagId: "tag-a" },
      status: "synced",
    });
    const staleServer = snapshot();
    const retained = relinquishConfirmedOperations([detach], {
      allLists: staleServer,
    });

    expect(retained).toEqual([detach]);
    expect(
      applyPendingOutboxOverlay(staleServer, retained).lists[0].listTags,
    ).toEqual([]);

    const confirmedServer = snapshot();
    confirmedServer.lists[0].listTags = [];
    const relinquished = relinquishConfirmedOperations([detach], {
      allLists: confirmedServer,
    });

    expect(relinquished).toEqual([]);
    expect(
      applyPendingOutboxOverlay(confirmedServer, relinquished).lists[0]
        .listTags,
    ).toEqual([]);
  });

  it("drops synced movement and keeps other movement statuses", () => {
    const operations = (["synced", "pending", "syncing", "failed"] as const)
      .map((status) =>
        operation({
          operationId: status,
          entityType: "listItem",
          entityClientId: "list-a",
          operationType: "reorder",
          payload: { listId: "list-a", orderedIds: ["item-a", "item-b"] },
          status,
        }),
      );

    expect(
      relinquishConfirmedOperations(operations, {
        allLists: snapshot(),
      }).map((candidate) => candidate.status),
    ).toEqual(["pending", "syncing", "failed"]);
  });
});

describe("outboxOperationsSignature", () => {
  it("is stable for equal operations and changes with status or updatedAt", () => {
    const base = operation({
      operationId: "operation-a",
      entityType: "list",
      entityClientId: "list-a",
      operationType: "update",
      status: "pending",
      updatedAt: "2026-06-12T10:00:00.000Z",
    });

    expect(outboxOperationsSignature([base])).toBe(
      outboxOperationsSignature([{ ...base }]),
    );
    expect(outboxOperationsSignature([{ ...base, status: "synced" }])).not
      .toBe(outboxOperationsSignature([base]));
    expect(
      outboxOperationsSignature([
        { ...base, updatedAt: "2026-06-12T10:00:01.000Z" },
      ]),
    ).not.toBe(outboxOperationsSignature([base]));
  });
});

describe("applyPendingViewOverlay", () => {
  function views(): ViewsCache {
    return [
      view(),
      view({
        id: "view-a",
        name: "View A",
        type: "CUSTOM",
        isDefault: false,
        order: 1,
        viewTags: [
          {
            viewId: "view-a",
            tagId: "tag-a",
            tag: tag("tag-a", "Focus"),
          },
        ],
      }),
      view({
        id: "view-b",
        name: "View B",
        type: "CUSTOM",
        isDefault: false,
        order: 2,
      }),
    ];
  }

  it("replays view create with tag metadata", () => {
    const result = applyPendingViewOverlay(views(), [
      operation({
        entityType: "view",
        entityClientId: "view-local",
        operationType: "create",
        payload: {
          name: "Local View",
          tagIds: ["tag-a"],
          matchMode: "ANY",
        },
      }),
    ]);

    expect(result.find((candidate) => candidate.id === "view-local")).toMatchObject({
      userId: "optimistic",
      name: "Local View",
      type: "CUSTOM",
      isDefault: false,
      matchMode: "ANY",
      order: -1,
      viewTags: [
        {
          viewId: "view-local",
          tagId: "tag-a",
          tag: expect.objectContaining({ name: "Focus" }),
        },
      ],
      viewLists: [],
    });
  });

  it("replays view update and rebuilds view tags", () => {
    const result = applyPendingViewOverlay(views(), [
      operation({
        entityType: "view",
        entityClientId: "view-a",
        operationType: "update",
        payload: {
          name: "Updated View",
          tagIds: ["tag-b"],
          matchMode: "ANY",
        },
      }),
    ]);
    const updated = result.find((candidate) => candidate.id === "view-a");

    expect(updated).toMatchObject({
      name: "Updated View",
      matchMode: "ANY",
      viewTags: [{ viewId: "view-a", tagId: "tag-b" }],
    });
  });

  it("replays view delete", () => {
    const result = applyPendingViewOverlay(views(), [
      operation({
        entityType: "view",
        entityClientId: "view-a",
        operationType: "delete",
      }),
    ]);

    expect(result.map((candidate) => candidate.id)).toEqual([
      "view-all",
      "view-b",
    ]);
  });

  it("reorders custom views while leaving fixed views in place", () => {
    const result = applyPendingViewOverlay(views(), [
      operation({
        entityType: "view",
        entityClientId: "view-order",
        operationType: "reorder",
        payload: { orderedIds: ["view-b", "view-a"] },
      }),
    ]);

    expect(
      result.filter((candidate) => candidate.type === "CUSTOM").map(
        (candidate) => [candidate.id, candidate.order],
      ),
    ).toEqual([
      ["view-b", 0],
      ["view-a", 1],
    ]);
    expect(result.some((candidate) => candidate.id === "view-all")).toBe(true);
  });

  it("replays selected-view metadata", () => {
    const result = applyPendingViewOverlay(views(), [
      operation({
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        payload: { selectedViewId: "view-b" },
      }),
    ]);

    expect(
      result.map((candidate) => [candidate.id, candidate.isDefault]),
    ).toEqual([
      ["view-all", false],
      ["view-a", false],
      ["view-b", true],
    ]);
  });

  it("does not mutate the input", () => {
    const source = views();
    const original = structuredClone(source);
    const result = applyPendingViewOverlay(source, [
      operation({
        entityType: "view",
        entityClientId: "view-a",
        operationType: "update",
        payload: { name: "Updated" },
      }),
    ]);

    expect(source).toEqual(original);
    expect(result).not.toBe(source);
  });
});
