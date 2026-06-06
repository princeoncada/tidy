import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureOfflineWrite,
  readSyncStatusSurfaceForUser,
} from "@/lib/sync/offline-write-prototype";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  getOutboxOperationsForUser,
  markOutboxOperationDiscarded,
  markOutboxOperationFailed,
  markOutboxOperationSynced,
  markOutboxOperationSyncing,
  type LocalOutboxRepositoryDatabase,
} from "@/lib/local-db/outbox-repository";

function createFakeOutboxDb() {
  const store = new Map<string, LocalOutboxOperation>();

  const db: LocalOutboxRepositoryDatabase = {
    outboxOperations: {
      put: vi.fn(async (operation: LocalOutboxOperation) => {
        store.set(operation.operationId, operation);
        return operation.operationId;
      }),
      get: vi.fn(async (operationId: string) => store.get(operationId)),
      where: vi.fn((indexName: string) => ({
        equals: vi.fn((value: unknown) => ({
          sortBy: vi.fn(async (fieldName: string) => {
            return [...store.values()]
              .filter((operation) => {
                if (indexName === "userId") {
                  return operation.userId === value;
                }

                if (indexName === "[userId+status]" && Array.isArray(value)) {
                  const [userId, status] = value;
                  return operation.userId === userId && operation.status === status;
                }

                return false;
              })
              .sort((left, right) => {
                const leftValue = left[fieldName as keyof LocalOutboxOperation];
                const rightValue = right[fieldName as keyof LocalOutboxOperation];

                return String(leftValue).localeCompare(String(rightValue));
              });
          }),
        })),
      })),
    },
  };

  return {
    db,
    store,
  };
}

async function createOperation(
  db: LocalOutboxRepositoryDatabase,
  overrides: {
    userId?: string;
    createdAt?: string;
    status?: LocalOutboxOperation["status"];
  } = {},
) {
  const operation = await captureOfflineWrite(
    {
      userId: overrides.userId ?? "user-1",
      entityType: "list",
      entityClientId: `local-${crypto.randomUUID()}`,
      operationType: "update",
      payload: { name: "Inbox" },
    },
    { db },
  );

  const nextOperation = {
    ...operation,
    status: overrides.status ?? operation.status,
    createdAt: overrides.createdAt ?? operation.createdAt,
    updatedAt: overrides.createdAt ?? operation.updatedAt,
  };

  await db.outboxOperations.put(nextOperation);
  return nextOperation;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sync status reader", () => {
  it("reads all statuses for one user ordered by createdAt", async () => {
    const { db, store } = createFakeOutboxDb();
    const pending = await createOperation(db, {
      createdAt: "2026-05-10T10:00:02.000Z",
    });
    const syncing = await createOperation(db, {
      createdAt: "2026-05-10T10:00:01.000Z",
    });
    const synced = await createOperation(db, {
      createdAt: "2026-05-10T10:00:04.000Z",
    });
    const failed = await createOperation(db, {
      createdAt: "2026-05-10T10:00:03.000Z",
    });
    const discarded = await createOperation(db, {
      createdAt: "2026-05-10T10:00:05.000Z",
    });
    await createOperation(db, {
      userId: "user-2",
      createdAt: "2026-05-10T10:00:00.000Z",
    });

    const syncingResult = await markOutboxOperationSyncing({
      operationId: syncing.operationId,
      db,
      updatedAt: syncing.updatedAt,
    });
    const syncedResult = await markOutboxOperationSynced({
      operationId: synced.operationId,
      db,
      updatedAt: synced.updatedAt,
    });
    const failedResult = await markOutboxOperationFailed({
      operationId: failed.operationId,
      db,
      updatedAt: failed.updatedAt,
      errorMessage: "Network unavailable",
    });
    const discardedResult = await markOutboxOperationDiscarded({
      operationId: discarded.operationId,
      db,
      updatedAt: discarded.updatedAt,
    });

    const operations = await getOutboxOperationsForUser({ userId: "user-1", db });

    expect(operations).toEqual([
      syncingResult,
      pending,
      failedResult,
      syncedResult,
      discardedResult,
    ]);
    expect(operations.map((operation) => operation.status)).toEqual([
      "syncing",
      "pending",
      "failed",
      "synced",
      "discarded",
    ]);
    expect([...store.values()].some((operation) => operation.userId === "user-2")).toBe(true);
  });

  it("returns the idle surface without reading while the gate is off", async () => {
    const { db } = createFakeOutboxDb();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "false");

    const surface = await readSyncStatusSurfaceForUser({ userId: "user-1", db });

    expect(surface).toMatchObject({
      state: "idle",
      totalCount: 0,
      visibleCount: 0,
      hasActionableFailure: false,
    });
    expect(db.outboxOperations.where).not.toHaveBeenCalled();
  });

  it("returns counts from the stored operations when the gate is on", async () => {
    const { db } = createFakeOutboxDb();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");
    const syncing = await createOperation(db);
    const failed = await createOperation(db);
    await createOperation(db, { userId: "user-2" });
    await markOutboxOperationSyncing({
      operationId: syncing.operationId,
      db,
      updatedAt: syncing.updatedAt,
    });
    await markOutboxOperationFailed({
      operationId: failed.operationId,
      db,
      updatedAt: failed.updatedAt,
      errorMessage: "Network unavailable",
    });

    const surface = await readSyncStatusSurfaceForUser({ userId: "user-1", db });

    expect(surface).toMatchObject({
      state: "failed",
      visibleCount: 2,
      hasActionableFailure: true,
      counts: {
        pending: 0,
        syncing: 1,
        synced: 0,
        failed: 1,
        discarded: 0,
      },
    });
  });

  it("returns the idle surface and logs when reading fails", async () => {
    const { db } = createFakeOutboxDb();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");
    vi.mocked(db.outboxOperations.where).mockImplementationOnce(() => {
      throw new Error("IndexedDB unavailable");
    });

    const surface = await readSyncStatusSurfaceForUser({ userId: "user-1", db });

    expect(surface).toMatchObject({
      state: "idle",
      totalCount: 0,
      visibleCount: 0,
      hasActionableFailure: false,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to read sync status surface",
      expect.any(Error),
    );
  });
});
