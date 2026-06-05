import { describe, expect, it, vi } from "vitest";

import {
  replayOutboxOperations,
  type SyncReplayRepository,
  type SyncReplayTransport,
} from "@/lib/local-db/sync-replay-client";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  SYNC_ENDPOINT_MAX_PAYLOAD_BYTES,
  validateSyncEndpointRequest,
} from "@/lib/sync/sync-endpoint-contract";

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

function createEndpointTransport({
  authenticatedUserId,
  maxPayloadBytes,
}: {
  authenticatedUserId: string;
  maxPayloadBytes?: number;
}): SyncReplayTransport {
  return async (request) => {
    const context =
      maxPayloadBytes === undefined
        ? { authenticatedUserId }
        : {
            authenticatedUserId,
            maxPayloadBytes,
          };
    const result = validateSyncEndpointRequest(request, {
      ...context,
    });

    if (!result.ok) {
      throw new Error(result.errors.join("; "));
    }
  };
}

describe("sync replay to endpoint contract integration", () => {
  it("replays valid pending operations through endpoint validation", async () => {
    const operations = [
      createOperation({
        operationId: "list-update",
        idempotencyKey: "list-update-key",
      }),
      createOperation({
        operationId: "item-move",
        entityType: "listItem",
        entityClientId: "local-item-1",
        entityServerId: "server-item-1",
        operationType: "move",
        payload: { toListClientId: "local-list-2" },
        idempotencyKey: "item-move-key",
      }),
      createOperation({
        operationId: "tag-update",
        entityType: "tag",
        entityClientId: "local-tag-1",
        entityServerId: "server-tag-1",
        operationType: "update",
        payload: { name: "Errands" },
        idempotencyKey: "tag-update-key",
      }),
    ];
    const repository = createReplayRepository(operations);
    const transport = vi.fn(createEndpointTransport({ authenticatedUserId: "user-1" }));

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(result).toMatchObject({
      syncedCount: operations.length,
      failedCount: 0,
    });
    expect(transport).toHaveBeenCalledTimes(operations.length);
    expect(transport).toHaveBeenNthCalledWith(1, {
      operation: expect.objectContaining({
        operationId: "list-update",
        status: "syncing",
        idempotencyKey: "list-update-key",
      }),
      idempotencyKey: "list-update-key",
    });
    expect(transport).toHaveBeenNthCalledWith(2, {
      operation: expect.objectContaining({
        operationId: "item-move",
        status: "syncing",
        idempotencyKey: "item-move-key",
      }),
      idempotencyKey: "item-move-key",
    });
    expect(transport).toHaveBeenNthCalledWith(3, {
      operation: expect.objectContaining({
        operationId: "tag-update",
        status: "syncing",
        idempotencyKey: "tag-update-key",
      }),
      idempotencyKey: "tag-update-key",
    });
  });

  it("keeps a coalesced survivor endpoint-valid and discards the superseded operation", async () => {
    const firstRename = createOperation({
      operationId: "rename-1",
      payload: { name: "Draft" },
      idempotencyKey: "rename-1-key",
    });
    const finalRename = createOperation({
      operationId: "rename-2",
      payload: { name: "Final" },
      idempotencyKey: "rename-2-key",
      createdAt: "2026-05-10T10:01:00.000Z",
    });
    const repository = createReplayRepository([firstRename, finalRename]);
    const transport = vi.fn(createEndpointTransport({ authenticatedUserId: "user-1" }));

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationDiscarded).toHaveBeenCalledWith({ operationId: "rename-1" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operation: expect.objectContaining({
        operationId: "rename-2",
        status: "syncing",
      }),
      idempotencyKey: "rename-2-key",
    });
    expect(result).toMatchObject({
      discardedCount: 1,
      syncedCount: 1,
      failedCount: 0,
    });
  });

  it("marks endpoint rejections failed and continues replaying the remaining queue", async () => {
    const rejectedOperation = createOperation({
      operationId: "tag-move",
      entityType: "tag",
      entityClientId: "local-tag-1",
      entityServerId: "server-tag-1",
      operationType: "move",
      payload: { targetClientId: "local-tag-2" },
      idempotencyKey: "tag-move-key",
    });
    const succeedingOperation = createOperation({
      operationId: "list-update",
      entityClientId: "local-list-2",
      entityServerId: "server-list-2",
      payload: { name: "Today" },
      idempotencyKey: "list-update-key",
    });
    const repository = createReplayRepository([rejectedOperation, succeedingOperation]);
    const transport = vi.fn(createEndpointTransport({ authenticatedUserId: "user-1" }));

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.incrementRetryCount).toHaveBeenCalledWith({ operationId: "tag-move" });
    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "tag-move",
      errorMessage: "Operation type is not allowed for entity type.",
    });
    expect(repository.markOutboxOperationSynced).toHaveBeenCalledWith({ operationId: "list-update" });
    expect(result).toMatchObject({
      failedCount: 1,
      syncedCount: 1,
    });
    expect(result.results).toEqual([
      {
        operationId: "tag-move",
        status: "failed",
        errorMessage: "Operation type is not allowed for entity type.",
      },
      {
        operationId: "list-update",
        status: "synced",
        errorMessage: null,
      },
    ]);
  });

  it("threads endpoint payload limits through replay failures", async () => {
    const rejectedOperation = createOperation({
      operationId: "oversized-payload",
      payload: { name: "x".repeat(SYNC_ENDPOINT_MAX_PAYLOAD_BYTES + 1) },
      idempotencyKey: "oversized-payload-key",
    });
    const repository = createReplayRepository([rejectedOperation]);
    const transport = vi.fn(createEndpointTransport({ authenticatedUserId: "user-1" }));

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "oversized-payload",
      errorMessage: "Operation payload exceeds the sync endpoint size limit.",
    });
    expect(result).toMatchObject({
      failedCount: 1,
      syncedCount: 0,
    });
  });

  it("keeps the endpoint as the auth authority at the replay seam", async () => {
    const operation = createOperation({
      operationId: "wrong-user",
      userId: "user-1",
      idempotencyKey: "wrong-user-key",
    });
    const repository = createReplayRepository([operation]);
    const transport = vi.fn(createEndpointTransport({ authenticatedUserId: "user-2" }));

    const result = await replayOutboxOperations({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "wrong-user",
      errorMessage: "Operation user does not match authenticated user.",
    });
    expect(result).toMatchObject({
      failedCount: 1,
      syncedCount: 0,
    });
  });
});
