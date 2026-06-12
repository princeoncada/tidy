import { describe, expect, it, vi } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  flushOutboxOperationsBatch,
  type SyncReplayRepository,
} from "@/lib/local-db/sync-replay-client";
import {
  SYNC_BATCH_MAX_OPERATIONS,
  type SyncBatchRequest,
} from "@/lib/sync/sync-batch-contract";

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
    status: "pending",
    retryCount: 0,
    errorMessage: null,
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-10T10:00:00.000Z",
    lastAttemptedAt: null,
    idempotencyKey: "op-1-key",
    ...overrides,
  };
}

function updateOperation(
  operations: LocalOutboxOperation[],
  operationId: string,
  update: (operation: LocalOutboxOperation) => LocalOutboxOperation,
): LocalOutboxOperation | null {
  const index = operations.findIndex(
    (operation) => operation.operationId === operationId,
  );
  const operation = operations[index];

  if (index < 0 || !operation) {
    return null;
  }

  const updated = update(operation);
  operations[index] = updated;
  return updated;
}

function createRepository(
  pendingOperations: LocalOutboxOperation[],
): SyncReplayRepository {
  const operations = [...pendingOperations];

  return {
    getPendingOutboxOperations: vi.fn(async () => operations),
    getRetryableOutboxOperations: vi.fn(async () => operations),
    markOutboxOperationDiscarded: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        status: "discarded",
      }))),
    markOutboxOperationSyncing: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        status: "syncing",
      }))),
    markOutboxOperationSynced: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        status: "synced",
      }))),
    markOutboxOperationFailed: vi.fn(async ({ operationId, errorMessage }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        status: "failed",
        errorMessage,
      }))),
    incrementRetryCount: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        retryCount: operation.retryCount + 1,
      }))),
  };
}

describe("sync batch client", () => {
  it("sends several pending operations in exactly one transport call", async () => {
    const operations = [
      createOperation(),
      createOperation({
        operationId: "op-2",
        entityClientId: "list-2",
        idempotencyKey: "op-2-key",
      }),
    ];
    const repository = createRepository(operations);
    const transport = vi.fn(async () => [
      {
        operationId: "op-1",
        status: "applied" as const,
        errorMessage: null,
      },
      {
        operationId: "op-2",
        status: "already-applied" as const,
        errorMessage: null,
      },
    ]);

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operations: [
        {
          operation: expect.objectContaining({
            operationId: "op-1",
            status: "syncing",
          }),
          idempotencyKey: "op-1-key",
        },
        {
          operation: expect.objectContaining({
            operationId: "op-2",
            status: "syncing",
          }),
          idempotencyKey: "op-2-key",
        },
      ],
    });
    expect(repository.markOutboxOperationSynced).toHaveBeenCalledTimes(2);
    expect(replay).toMatchObject({
      attemptedCount: 2,
      syncedCount: 2,
      failedCount: 0,
    });
  });

  it("caps a flush at the batch operation limit even with an unbounded repository", async () => {
    const operations = Array.from(
      { length: SYNC_BATCH_MAX_OPERATIONS + 1 },
      (_, index) => createOperation({
        operationId: `op-${index}`,
        entityClientId: `list-${index}`,
        idempotencyKey: `op-${index}-key`,
      }),
    );
    const repository = createRepository(operations);
    const transport = vi.fn(async (request: SyncBatchRequest) =>
      request.operations.map(({ operation }) => ({
        operationId: operation.operationId,
        status: "applied" as const,
        errorMessage: null,
      })));

    await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.getRetryableOutboxOperations).toHaveBeenCalledWith({
      userId: "user-1",
      now: expect.any(Number),
      limit: SYNC_BATCH_MAX_OPERATIONS,
    });
    expect(transport.mock.calls[0]?.[0].operations).toHaveLength(
      SYNC_BATCH_MAX_OPERATIONS,
    );
  });

  it("coalesces superseded operations before building the one request", async () => {
    const first = createOperation({
      operationId: "rename-1",
      idempotencyKey: "rename-1-key",
      payload: { name: "Draft" },
    });
    const final = createOperation({
      operationId: "rename-2",
      idempotencyKey: "rename-2-key",
      payload: { name: "Final" },
      createdAt: "2026-06-10T10:01:00.000Z",
    });
    const repository = createRepository([first, final]);
    const transport = vi.fn(async () => [{
      operationId: "rename-2",
      status: "applied" as const,
      errorMessage: null,
    }]);

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationDiscarded).toHaveBeenCalledWith({
      operationId: "rename-1",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operations: [{
        operation: expect.objectContaining({
          operationId: "rename-2",
          payload: { name: "Final" },
        }),
        idempotencyKey: "rename-2-key",
      }],
    });
    expect(replay).toMatchObject({
      discardedCount: 1,
      syncedCount: 1,
    });
  });

  it("marks permanent rejects failed without incrementing retry and transient failures with retry", async () => {
    const repository = createRepository([
      createOperation(),
      createOperation({
        operationId: "op-2",
        entityClientId: "list-2",
        idempotencyKey: "op-2-key",
      }),
    ]);
    const transport = vi.fn(async () => [
      {
        operationId: "op-1",
        status: "rejected" as const,
        errorMessage: "Permanent ownership rejection",
      },
      {
        operationId: "op-2",
        status: "failed" as const,
        errorMessage: "Database unavailable",
      },
    ]);

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.incrementRetryCount).toHaveBeenCalledTimes(1);
    expect(repository.incrementRetryCount).toHaveBeenCalledWith({
      operationId: "op-2",
    });
    expect(repository.markOutboxOperationFailed).toHaveBeenNthCalledWith(1, {
      operationId: "op-1",
      errorMessage: "Permanent ownership rejection",
    });
    expect(repository.markOutboxOperationFailed).toHaveBeenNthCalledWith(2, {
      operationId: "op-2",
      errorMessage: "Database unavailable",
    });
    expect(replay).toMatchObject({
      syncedCount: 0,
      failedCount: 2,
    });
  });

  it("marks the whole attempted batch retryable after a total transport failure", async () => {
    const repository = createRepository([
      createOperation(),
      createOperation({
        operationId: "op-2",
        entityClientId: "list-2",
        idempotencyKey: "op-2-key",
      }),
    ]);
    const transport = vi.fn(async () => {
      throw new Error("Network unavailable");
    });

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(repository.incrementRetryCount).toHaveBeenCalledTimes(2);
    expect(repository.markOutboxOperationFailed).toHaveBeenCalledTimes(2);
    expect(replay).toMatchObject({
      attemptedCount: 2,
      syncedCount: 0,
      failedCount: 2,
    });
  });
});
