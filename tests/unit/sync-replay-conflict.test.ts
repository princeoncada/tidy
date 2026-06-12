import { describe, expect, it, vi } from "vitest";

import {
  replayOutboxOperations,
  type SyncReplayRepository,
  type SyncReplayTransport,
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

function updateOperation(
  operations: LocalOutboxOperation[],
  operationId: string,
  update: (operation: LocalOutboxOperation) => LocalOutboxOperation,
): LocalOutboxOperation | null {
  const index = operations.findIndex((operation) => operation.operationId === operationId);

  if (index === -1) {
    return null;
  }

  const operation = operations[index];

  if (!operation) {
    return null;
  }

  const updatedOperation = update(operation);
  operations[index] = updatedOperation;
  return updatedOperation;
}

function createReplayRepository(pendingOperations: LocalOutboxOperation[]): SyncReplayRepository {
  const operations = [...pendingOperations];

  return {
    getPendingOutboxOperations: vi.fn(async () => operations),
    getRetryableOutboxOperations: vi.fn(async () => operations),
    markOutboxOperationDiscarded: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({ ...operation, status: "discarded" })),
    ),
    markOutboxOperationSyncing: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({ ...operation, status: "syncing" })),
    ),
    markOutboxOperationSynced: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({ ...operation, status: "synced" })),
    ),
    markOutboxOperationFailed: vi.fn(async ({ operationId, errorMessage }) =>
      updateOperation(operations, operationId, (operation) => ({ ...operation, status: "failed", errorMessage })),
    ),
    incrementRetryCount: vi.fn(async ({ operationId }) =>
      updateOperation(operations, operationId, (operation) => ({
        ...operation,
        retryCount: operation.retryCount + 1,
      })),
    ),
  };
}

describe("sync replay conflict resolution seam", () => {
  it("resolves a server-wins operation without calling transport", async () => {
    const operation = createOperation({
      operationId: "server-wins",
      idempotencyKey: "server-wins-key",
      updatedAt: "2026-05-10T10:00:00.000Z",
    });
    const repository = createReplayRepository([operation]);
    const transport = vi.fn<SyncReplayTransport>();

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
      getServerSnapshot: async () => ({
        entityServerId: "server-list-1",
        updatedAt: "2026-05-10T10:00:01.000Z",
      }),
    });

    expect(transport).not.toHaveBeenCalled();
    expect(repository.markOutboxOperationDiscarded).toHaveBeenCalledWith({
      operationId: "server-wins",
    });
    expect(result.serverWonCount).toBe(1);
    expect(result.results).toEqual([
      {
        operationId: "server-wins",
        status: "resolved-server-wins",
        errorMessage: null,
      },
    ]);
  });

  it("replays a client-wins operation through syncing, transport, and synced", async () => {
    const operation = createOperation({
      operationId: "client-wins",
      idempotencyKey: "client-wins-key",
      updatedAt: "2026-05-10T10:00:01.000Z",
    });
    const repository = createReplayRepository([operation]);
    const transport = vi.fn<SyncReplayTransport>(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
      getServerSnapshot: async () => ({
        entityServerId: "server-list-1",
        updatedAt: "2026-05-10T10:00:00.000Z",
      }),
    });

    expect(repository.markOutboxOperationSyncing).toHaveBeenCalledWith({
      operationId: "client-wins",
    });
    expect(transport).toHaveBeenCalledWith({
      operation: expect.objectContaining({
        operationId: "client-wins",
        status: "syncing",
      }),
      idempotencyKey: "client-wins-key",
    });
    expect(repository.markOutboxOperationSynced).toHaveBeenCalledWith({
      operationId: "client-wins",
    });
    expect(result).toMatchObject({
      syncedCount: 1,
      serverWonCount: 0,
    });
  });

  it("replays a mixed queue deterministically and transports only client-wins operations", async () => {
    const serverWins = createOperation({
      operationId: "server-wins",
      entityClientId: "local-list-1",
      entityServerId: "server-list-1",
      idempotencyKey: "server-wins-key",
      updatedAt: "2026-05-10T10:00:00.000Z",
    });
    const clientWins = createOperation({
      operationId: "client-wins",
      entityClientId: "local-list-2",
      entityServerId: "server-list-2",
      idempotencyKey: "client-wins-key",
      updatedAt: "2026-05-10T10:00:02.000Z",
    });
    const repository = createReplayRepository([serverWins, clientWins]);
    const transport = vi.fn<SyncReplayTransport>(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
      getServerSnapshot: async (operation) => ({
        entityServerId: operation.entityServerId,
        updatedAt: "2026-05-10T10:00:01.000Z",
      }),
    });

    expect(result).toMatchObject({
      serverWonCount: 1,
      syncedCount: 1,
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operation: expect.objectContaining({
        operationId: "client-wins",
        status: "syncing",
      }),
      idempotencyKey: "client-wins-key",
    });
  });

  it("preserves the pre-conflict path when no snapshot provider is supplied", async () => {
    const firstOperation = createOperation({
      operationId: "first-operation",
      entityClientId: "local-list-1",
      entityServerId: "server-list-1",
      idempotencyKey: "first-operation-key",
    });
    const secondOperation = createOperation({
      operationId: "second-operation",
      entityClientId: "local-list-2",
      entityServerId: "server-list-2",
      idempotencyKey: "second-operation-key",
    });
    const repository = createReplayRepository([firstOperation, secondOperation]);
    const transport = vi.fn<SyncReplayTransport>(async () => undefined);

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(result).toMatchObject({
      serverWonCount: 0,
      syncedCount: 2,
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenNthCalledWith(1, {
      operation: expect.objectContaining({
        operationId: "first-operation",
        status: "syncing",
      }),
      idempotencyKey: "first-operation-key",
    });
    expect(transport).toHaveBeenNthCalledWith(2, {
      operation: expect.objectContaining({
        operationId: "second-operation",
        status: "syncing",
      }),
      idempotencyKey: "second-operation-key",
    });
  });
});
