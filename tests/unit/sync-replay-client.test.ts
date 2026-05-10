import { describe, expect, it, vi } from "vitest";

import {
  replayOutboxOperations,
  type SyncReplayRepository,
} from "@/lib/local-db/sync-replay-client";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

function createOperation(overrides: Partial<LocalOutboxOperation> = {}): LocalOutboxOperation {
  return {
    operationId: "op-1",
    userId: "user-1",
    entityType: "list",
    entityClientId: "local-list-1",
    entityServerId: "server-list-1",
    operationType: "update",
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

function createReplayRepository(
  pendingOperations: LocalOutboxOperation[],
  overrides: Partial<SyncReplayRepository> = {},
): SyncReplayRepository {
  return {
    getPendingOutboxOperations: vi.fn(async () => pendingOperations),
    markOutboxOperationDiscarded: vi.fn(async ({ operationId }) =>
      pendingOperations.find((operation) => operation.operationId === operationId) ?? null,
    ),
    markOutboxOperationSyncing: vi.fn(async ({ operationId }) => {
      const operation = pendingOperations.find((pendingOperation) => pendingOperation.operationId === operationId);
      return operation ? ({ ...operation, status: "syncing" } satisfies LocalOutboxOperation) : null;
    }),
    markOutboxOperationSynced: vi.fn(async ({ operationId }) =>
      pendingOperations.find((operation) => operation.operationId === operationId) ?? null,
    ),
    markOutboxOperationFailed: vi.fn(async ({ operationId, errorMessage }) => {
      const operation = pendingOperations.find((pendingOperation) => pendingOperation.operationId === operationId);
      return operation ? ({ ...operation, status: "failed", errorMessage } satisfies LocalOutboxOperation) : null;
    }),
    incrementRetryCount: vi.fn(async ({ operationId }) => {
      const operation = pendingOperations.find((pendingOperation) => pendingOperation.operationId === operationId);
      return operation ? { ...operation, retryCount: operation.retryCount + 1 } : null;
    }),
    ...overrides,
  };
}

describe("sync replay client", () => {
  it("returns an empty result when there are no pending operations", async () => {
    const repository = createReplayRepository([]);
    const transport = vi.fn(async () => undefined);

    await expect(
      replayOutboxOperations({
        userId: "user-1",
        transport,
        repository,
      }),
    ).resolves.toEqual({
      attemptedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      discardedCount: 0,
      missingCount: 0,
      results: [],
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("replays pending operations in safe created order with idempotency keys", async () => {
    const first = createOperation({
      operationId: "op-1",
      createdAt: "2026-05-10T10:00:00.000Z",
      idempotencyKey: "key-1",
    });
    const second = createOperation({
      operationId: "op-2",
      entityClientId: "local-list-2",
      createdAt: "2026-05-10T10:01:00.000Z",
      idempotencyKey: "key-2",
    });
    const repository = createReplayRepository([first, second]);
    const transport = vi.fn(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationSyncing).toHaveBeenNthCalledWith(1, { operationId: "op-1" });
    expect(repository.markOutboxOperationSyncing).toHaveBeenNthCalledWith(2, { operationId: "op-2" });
    expect(transport).toHaveBeenNthCalledWith(1, {
      operation: expect.objectContaining({ operationId: "op-1", status: "syncing" }),
      idempotencyKey: "key-1",
    });
    expect(transport).toHaveBeenNthCalledWith(2, {
      operation: expect.objectContaining({ operationId: "op-2", status: "syncing" }),
      idempotencyKey: "key-2",
    });
    expect(repository.markOutboxOperationSynced).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      attemptedCount: 2,
      syncedCount: 2,
      failedCount: 0,
      discardedCount: 0,
      missingCount: 0,
    });
  });

  it("coalesces pending operations before replay and marks superseded operations discarded", async () => {
    const firstRename = createOperation({
      operationId: "rename-1",
      payload: { name: "Draft" },
      idempotencyKey: "rename-1",
    });
    const finalRename = createOperation({
      operationId: "rename-2",
      payload: { name: "Final" },
      idempotencyKey: "rename-2",
    });
    const repository = createReplayRepository([firstRename, finalRename]);
    const transport = vi.fn(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationDiscarded).toHaveBeenCalledWith({ operationId: "rename-1" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operation: expect.objectContaining({ operationId: "rename-2" }),
      idempotencyKey: "rename-2",
    });
    expect(result).toMatchObject({
      attemptedCount: 1,
      syncedCount: 1,
      discardedCount: 1,
    });
  });

  it("increments retry count, marks failed, and continues replaying unrelated operations after transport failure", async () => {
    const failingOperation = createOperation({
      operationId: "op-fail",
      idempotencyKey: "op-fail",
    });
    const succeedingOperation = createOperation({
      operationId: "op-success",
      entityClientId: "local-list-2",
      idempotencyKey: "op-success",
    });
    const repository = createReplayRepository([failingOperation, succeedingOperation]);
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.incrementRetryCount).toHaveBeenCalledWith({ operationId: "op-fail" });
    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "op-fail",
      errorMessage: "Network unavailable",
    });
    expect(repository.markOutboxOperationSynced).toHaveBeenCalledWith({ operationId: "op-success" });
    expect(result).toMatchObject({
      attemptedCount: 2,
      syncedCount: 1,
      failedCount: 1,
      discardedCount: 0,
      missingCount: 0,
    });
    expect(result.results).toEqual([
      {
        operationId: "op-fail",
        status: "failed",
        errorMessage: "Network unavailable",
      },
      {
        operationId: "op-success",
        status: "synced",
        errorMessage: null,
      },
    ]);
  });

  it("does not transport an operation that disappears before replay", async () => {
    const operation = createOperation();
    const repository = createReplayRepository([operation], {
      markOutboxOperationSyncing: vi.fn(async () => null),
    });
    const transport = vi.fn(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attemptedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      discardedCount: 0,
      missingCount: 1,
    });
    expect(result.results[0]).toEqual({
      operationId: "op-1",
      status: "missing",
      errorMessage: "Outbox operation was not found before replay.",
    });
  });

  it("reports missing discarded operations without blocking remaining replay", async () => {
    const create = createOperation({
      operationId: "create-1",
      entityServerId: null,
      operationType: "create",
      idempotencyKey: "create-1",
    });
    const remove = createOperation({
      operationId: "delete-1",
      entityServerId: null,
      operationType: "delete",
      idempotencyKey: "delete-1",
    });
    const operation = createOperation({
      operationId: "op-keep",
      entityClientId: "local-list-2",
      idempotencyKey: "op-keep",
    });
    const repository = createReplayRepository([create, remove, operation], {
      markOutboxOperationDiscarded: vi.fn(async () => null),
    });
    const transport = vi.fn(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operation: expect.objectContaining({ operationId: "op-keep" }),
      idempotencyKey: "op-keep",
    });
    expect(result).toMatchObject({
      attemptedCount: 1,
      syncedCount: 1,
      failedCount: 0,
      discardedCount: 0,
      missingCount: 2,
    });
  });

  it("passes user and limit to the pending operation query", async () => {
    const repository = createReplayRepository([]);
    const transport = vi.fn(async () => undefined);

    await replayOutboxOperations({
      userId: "user-1",
      limit: 25,
      transport,
      repository,
    });

    expect(repository.getPendingOutboxOperations).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 25,
    });
  });
});
