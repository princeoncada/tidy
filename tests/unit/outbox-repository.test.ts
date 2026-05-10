import { describe, expect, it, vi } from "vitest";

import {
  enqueueOutboxOperation,
  getOutboxOperationById,
  getPendingOutboxOperations,
  incrementRetryCount,
  markOutboxOperationDiscarded,
  markOutboxOperationFailed,
  markOutboxOperationSynced,
  markOutboxOperationSyncing,
  type LocalOutboxRepositoryDatabase,
} from "@/lib/local-db/outbox-repository";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

function createOperation(overrides: Partial<LocalOutboxOperation> = {}): LocalOutboxOperation {
  return {
    operationId: "op-1",
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
    idempotencyKey: "op-1",
    ...overrides,
  };
}

function createFakeOutboxDb(initialOperations: LocalOutboxOperation[] = []) {
  const operations = new Map<string, LocalOutboxOperation>();

  for (const operation of initialOperations) {
    operations.set(operation.operationId, operation);
  }

  const db: LocalOutboxRepositoryDatabase = {
    outboxOperations: {
      put: vi.fn(async (operation) => {
        operations.set(operation.operationId, operation);
        return operation.operationId;
      }),
      get: vi.fn(async (operationId) => operations.get(operationId)),
      where: vi.fn((indexName) => ({
        equals: vi.fn((value) => ({
          sortBy: vi.fn(async (fieldName) => {
            if (indexName !== "[userId+status]" || !Array.isArray(value)) {
              return [];
            }

            const [userId, status] = value;

            return Array.from(operations.values())
              .filter((operation) => operation.userId === userId && operation.status === status)
              .sort((left, right) =>
                String(left[fieldName as keyof LocalOutboxOperation]).localeCompare(
                  String(right[fieldName as keyof LocalOutboxOperation]),
                ),
              );
          }),
        })),
      })),
    },
  };

  return { db, operations };
}

describe("outbox repository helpers", () => {
  it("enqueues a valid outbox operation", async () => {
    const operation = createOperation();
    const { db, operations } = createFakeOutboxDb();

    await expect(enqueueOutboxOperation(operation, db)).resolves.toBe("op-1");

    expect(operations.get("op-1")).toEqual(operation);
    expect(db.outboxOperations.put).toHaveBeenCalledWith(operation);
  });

  it("rejects invalid outbox operations before writing", async () => {
    const invalidOperation = createOperation({ operationId: "" });
    const { db } = createFakeOutboxDb();

    await expect(enqueueOutboxOperation(invalidOperation, db)).rejects.toThrow(
      "Invalid local outbox operation.",
    );
    expect(db.outboxOperations.put).not.toHaveBeenCalled();
  });

  it("gets an outbox operation by id or returns null", async () => {
    const { db } = createFakeOutboxDb([createOperation()]);

    await expect(getOutboxOperationById("op-1", db)).resolves.toMatchObject({ operationId: "op-1" });
    await expect(getOutboxOperationById("missing-op", db)).resolves.toBeNull();
  });

  it("returns pending operations for a user in created order", async () => {
    const { db } = createFakeOutboxDb([
      createOperation({
        operationId: "op-late",
        createdAt: "2026-05-10T10:03:00.000Z",
        idempotencyKey: "op-late",
      }),
      createOperation({
        operationId: "op-other-user",
        userId: "user-2",
        createdAt: "2026-05-10T10:01:00.000Z",
        idempotencyKey: "op-other-user",
      }),
      createOperation({
        operationId: "op-failed",
        status: "failed",
        createdAt: "2026-05-10T10:02:00.000Z",
        idempotencyKey: "op-failed",
      }),
      createOperation({
        operationId: "op-early",
        createdAt: "2026-05-10T10:00:00.000Z",
        idempotencyKey: "op-early",
      }),
    ]);

    await expect(getPendingOutboxOperations({ userId: "user-1", db })).resolves.toEqual([
      expect.objectContaining({ operationId: "op-early" }),
      expect.objectContaining({ operationId: "op-late" }),
    ]);
  });

  it("limits pending operation results", async () => {
    const { db } = createFakeOutboxDb([
      createOperation({ operationId: "op-1", idempotencyKey: "op-1" }),
      createOperation({ operationId: "op-2", idempotencyKey: "op-2" }),
    ]);

    await expect(getPendingOutboxOperations({ userId: "user-1", limit: 1, db })).resolves.toEqual([
      expect.objectContaining({ operationId: "op-1" }),
    ]);
  });

  it("marks an operation syncing and records the attempt time", async () => {
    const { db } = createFakeOutboxDb([createOperation({ errorMessage: "Previous failure" })]);

    await expect(
      markOutboxOperationSyncing({
        operationId: "op-1",
        updatedAt: "2026-05-10T10:05:00.000Z",
        db,
      }),
    ).resolves.toMatchObject({
      status: "syncing",
      updatedAt: "2026-05-10T10:05:00.000Z",
      lastAttemptedAt: "2026-05-10T10:05:00.000Z",
      errorMessage: null,
    });
  });

  it("marks an operation synced and clears stale error text", async () => {
    const { db } = createFakeOutboxDb([
      createOperation({ status: "syncing", errorMessage: "Network failed" }),
    ]);

    await expect(
      markOutboxOperationSynced({
        operationId: "op-1",
        updatedAt: "2026-05-10T10:06:00.000Z",
        db,
      }),
    ).resolves.toMatchObject({
      status: "synced",
      updatedAt: "2026-05-10T10:06:00.000Z",
      errorMessage: null,
    });
  });

  it("marks an operation failed with a readable error", async () => {
    const { db } = createFakeOutboxDb([createOperation({ status: "syncing" })]);

    await expect(
      markOutboxOperationFailed({
        operationId: "op-1",
        errorMessage: "Server rejected operation",
        updatedAt: "2026-05-10T10:07:00.000Z",
        db,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      updatedAt: "2026-05-10T10:07:00.000Z",
      errorMessage: "Server rejected operation",
    });
  });

  it("marks an operation discarded", async () => {
    const { db } = createFakeOutboxDb([createOperation()]);

    await expect(
      markOutboxOperationDiscarded({
        operationId: "op-1",
        updatedAt: "2026-05-10T10:08:00.000Z",
        db,
      }),
    ).resolves.toMatchObject({
      status: "discarded",
      updatedAt: "2026-05-10T10:08:00.000Z",
    });
  });

  it("increments retry count without changing operation status", async () => {
    const { db } = createFakeOutboxDb([createOperation({ status: "failed", retryCount: 2 })]);

    await expect(
      incrementRetryCount({
        operationId: "op-1",
        updatedAt: "2026-05-10T10:09:00.000Z",
        db,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      retryCount: 3,
      updatedAt: "2026-05-10T10:09:00.000Z",
    });
  });

  it("returns null when updating a missing operation", async () => {
    const { db } = createFakeOutboxDb();

    await expect(
      markOutboxOperationSyncing({
        operationId: "missing-op",
        updatedAt: "2026-05-10T10:10:00.000Z",
        db,
      }),
    ).resolves.toBeNull();
    expect(db.outboxOperations.put).not.toHaveBeenCalled();
  });
});
