import { describe, expect, it } from "vitest";

import {
  createLocalEntityBase,
  createLocalTimestamp,
  createOutboxOperation,
  listLocalListsForUser,
  listLocalViewsForUser,
  markEntityFailed,
  markEntityPending,
  markEntitySynced,
  putLocalLists,
  putLocalViews,
} from "@/lib/local-db/local-repositories";
import type { LocalEntityBase, LocalList, LocalView } from "@/lib/local-db/local-schema";
import type { TidyLocalDatabase } from "@/lib/local-db/tidy-db";

const baseEntity = (overrides: Partial<LocalEntityBase> = {}): LocalEntityBase => ({
  clientId: "local-list-1",
  serverId: null,
  userId: "user-1",
  syncStatus: "local",
  createdAt: "2026-05-10T10:00:00.000Z",
  updatedAt: "2026-05-10T10:00:00.000Z",
  deletedAt: null,
  lastSyncedAt: null,
  ...overrides,
});

function localList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    ...baseEntity(),
    name: "Inbox",
    ...overrides,
  };
}

function localView(overrides: Partial<LocalView> = {}): LocalView {
  return {
    ...baseEntity({ clientId: "local-view-1" }),
    name: "All Lists",
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    ...overrides,
  };
}

function createFakeLocalDb(args: {
  lists?: LocalList[];
  views?: LocalView[];
} = {}) {
  const lists = new Map<string, LocalList>();
  const views = new Map<string, LocalView>();

  for (const list of args.lists ?? []) {
    lists.set(list.clientId, list);
  }

  for (const view of args.views ?? []) {
    views.set(view.clientId, view);
  }

  const table = <T extends LocalList | LocalView>(store: Map<string, T>) => ({
    where: (indexName: string) => ({
      equals: (value: unknown) => ({
        toArray: async () =>
          indexName === "userId"
            ? [...store.values()].filter((row) => row.userId === value)
            : [],
      }),
    }),
    bulkPut: async (rows: T[]) => {
      for (const row of rows) {
        store.set(row.clientId, row);
      }
    },
  });

  return {
    db: {
      lists: table(lists),
      views: table(views),
    } as unknown as TidyLocalDatabase,
    lists,
    views,
  };
}

describe("local repository helpers", () => {
  it("creates ISO timestamps", () => {
    expect(createLocalTimestamp(new Date("2026-05-10T12:34:56.789Z"))).toBe(
      "2026-05-10T12:34:56.789Z",
    );
  });

  it("creates a local entity base with nullable server fields and local sync status", () => {
    expect(
      createLocalEntityBase({
        clientId: "local-view-1",
        userId: "user-1",
        createdAt: "2026-05-10T10:00:00.000Z",
      }),
    ).toEqual({
      clientId: "local-view-1",
      serverId: null,
      userId: "user-1",
      syncStatus: "local",
      createdAt: "2026-05-10T10:00:00.000Z",
      updatedAt: "2026-05-10T10:00:00.000Z",
      deletedAt: null,
      lastSyncedAt: null,
    });
  });

  it("allows explicit server and sync metadata when creating a base entity", () => {
    expect(
      createLocalEntityBase({
        clientId: "local-list-1",
        serverId: "server-list-1",
        userId: "user-1",
        syncStatus: "synced",
        createdAt: "2026-05-10T10:00:00.000Z",
        updatedAt: "2026-05-10T10:01:00.000Z",
        deletedAt: "2026-05-10T10:02:00.000Z",
        lastSyncedAt: "2026-05-10T10:03:00.000Z",
      }),
    ).toMatchObject({
      serverId: "server-list-1",
      syncStatus: "synced",
      updatedAt: "2026-05-10T10:01:00.000Z",
      deletedAt: "2026-05-10T10:02:00.000Z",
      lastSyncedAt: "2026-05-10T10:03:00.000Z",
    });
  });

  it("marks an entity pending without mutating the original entity", () => {
    const entity = baseEntity();
    const pending = markEntityPending(entity, "2026-05-10T11:00:00.000Z");

    expect(pending).toMatchObject({
      syncStatus: "pending",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(entity.syncStatus).toBe("local");
  });

  it("marks an entity synced with server id and last sync time", () => {
    expect(
      markEntitySynced(baseEntity({ syncStatus: "pending" }), "server-list-1", "2026-05-10T11:00:00.000Z"),
    ).toMatchObject({
      serverId: "server-list-1",
      syncStatus: "synced",
      updatedAt: "2026-05-10T11:00:00.000Z",
      lastSyncedAt: "2026-05-10T11:00:00.000Z",
    });
  });

  it("marks an entity failed", () => {
    expect(markEntityFailed(baseEntity({ syncStatus: "syncing" }), "2026-05-10T11:00:00.000Z")).toMatchObject({
      syncStatus: "failed",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
  });

  it("creates a pending outbox operation with default retry and idempotency fields", () => {
    const operation = createOutboxOperation({
      userId: "user-1",
      entityType: "list",
      entityClientId: "local-list-1",
      operationType: "create",
      payload: { name: "Inbox" },
      createdAt: "2026-05-10T10:00:00.000Z",
    });

    expect(operation).toEqual({
      operationId: operation.operationId,
      userId: "user-1",
      entityType: "list",
      entityClientId: "local-list-1",
      entityServerId: null,
      operationType: "create",
      payload: { name: "Inbox" },
      status: "pending",
      retryCount: 0,
      errorMessage: null,
      createdAt: "2026-05-10T10:00:00.000Z",
      updatedAt: "2026-05-10T10:00:00.000Z",
      lastAttemptedAt: null,
      idempotencyKey: operation.operationId,
    });
    expect(operation.operationId).toEqual(expect.any(String));
  });

  it("allows explicit outbox failure metadata", () => {
    expect(
      createOutboxOperation({
        operationId: "op-2",
        userId: "user-1",
        entityType: "listItem",
        entityClientId: "local-item-1",
        entityServerId: "server-item-1",
        operationType: "update",
        payload: { name: "Renamed" },
        status: "failed",
        retryCount: 2,
        errorMessage: "Network unavailable",
        createdAt: "2026-05-10T10:00:00.000Z",
        updatedAt: "2026-05-10T10:05:00.000Z",
        lastAttemptedAt: "2026-05-10T10:04:00.000Z",
        idempotencyKey: "custom-key",
      }),
    ).toMatchObject({
      entityServerId: "server-item-1",
      status: "failed",
      retryCount: 2,
      errorMessage: "Network unavailable",
      updatedAt: "2026-05-10T10:05:00.000Z",
      lastAttemptedAt: "2026-05-10T10:04:00.000Z",
      idempotencyKey: "custom-key",
    });
  });

  it("lists local lists for one user and filters deleted rows", async () => {
    const { db } = createFakeLocalDb({
      lists: [
        localList({ clientId: "user-1-active", userId: "user-1" }),
        localList({ clientId: "user-1-deleted", userId: "user-1", deletedAt: "2026-05-10T12:00:00.000Z" }),
        localList({ clientId: "user-2-active", userId: "user-2" }),
      ],
    });

    await expect(listLocalListsForUser("user-1", db)).resolves.toEqual([
      expect.objectContaining({ clientId: "user-1-active" }),
    ]);
  });

  it("lists local views for one user and filters deleted rows", async () => {
    const { db } = createFakeLocalDb({
      views: [
        localView({ clientId: "user-1-active", userId: "user-1" }),
        localView({ clientId: "user-1-deleted", userId: "user-1", deletedAt: "2026-05-10T12:00:00.000Z" }),
        localView({ clientId: "user-2-active", userId: "user-2" }),
      ],
    });

    await expect(listLocalViewsForUser("user-1", db)).resolves.toEqual([
      expect.objectContaining({ clientId: "user-1-active" }),
    ]);
  });

  it("bulk writes local lists and views", async () => {
    const { db, lists, views } = createFakeLocalDb();

    await putLocalLists([localList({ clientId: "list-a" }), localList({ clientId: "list-b" })], db);
    await putLocalViews([localView({ clientId: "view-a" }), localView({ clientId: "view-b" })], db);

    expect([...lists.keys()]).toEqual(["list-a", "list-b"]);
    expect([...views.keys()]).toEqual(["view-a", "view-b"]);
  });
});
