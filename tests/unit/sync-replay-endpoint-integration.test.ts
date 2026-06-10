import { describe, expect, it, vi } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  flushOutboxOperationsBatch,
  type SyncBatchTransport,
  type SyncReplayRepository,
} from "@/lib/local-db/sync-replay-client";
import { validateSyncBatchRequest } from "@/lib/sync/sync-batch-contract";
import { SYNC_ENDPOINT_MAX_PAYLOAD_BYTES } from "@/lib/sync/sync-endpoint-contract";

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

function createEndpointTransport(
  authenticatedUserId: string,
): SyncBatchTransport {
  return async (request) => {
    const validation = validateSyncBatchRequest(request, {
      authenticatedUserId,
    });

    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    return validation.decisions.map((decision) =>
      decision.accepted
        ? {
            operationId: decision.operationId,
            status: "applied" as const,
            errorMessage: null,
          }
        : {
            operationId: decision.operationId,
            status: "rejected" as const,
            errorMessage: decision.errors.join("; "),
          });
  };
}

describe("sync batch replay to endpoint contract integration", () => {
  it("sends one endpoint request for several valid operations", async () => {
    const operations = [
      createOperation(),
      createOperation({
        operationId: "item-move",
        entityType: "listItem",
        entityClientId: "item-1",
        operationType: "move",
        payload: { toListClientId: "list-2", order: 0 },
        idempotencyKey: "item-move-key",
      }),
      createOperation({
        operationId: "tag-update",
        entityType: "tag",
        entityClientId: "tag-1",
        operationType: "update",
        payload: { name: "Errands" },
        idempotencyKey: "tag-update-key",
      }),
    ];
    const repository = createRepository(operations);
    const transport = vi.fn(createEndpointTransport("user-1"));

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith({
      operations: expect.arrayContaining([
        expect.objectContaining({
          operation: expect.objectContaining({ operationId: "op-1" }),
        }),
        expect.objectContaining({
          operation: expect.objectContaining({ operationId: "item-move" }),
        }),
        expect.objectContaining({
          operation: expect.objectContaining({ operationId: "tag-update" }),
        }),
      ]),
    });
    expect(replay).toMatchObject({
      syncedCount: 3,
      failedCount: 0,
    });
  });

  it("keeps the endpoint as the authentication authority for every operation", async () => {
    const repository = createRepository([
      createOperation({
        operationId: "wrong-user",
        idempotencyKey: "wrong-user-key",
      }),
    ]);
    const transport = vi.fn(createEndpointTransport("user-2"));

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "wrong-user",
      errorMessage: "Operation user does not match authenticated user.",
    });
    expect(repository.incrementRetryCount).not.toHaveBeenCalled();
    expect(replay).toMatchObject({
      syncedCount: 0,
      failedCount: 1,
    });
  });

  it("coalesces before the endpoint request", async () => {
    const first = createOperation({
      operationId: "rename-1",
      payload: { name: "Draft" },
      idempotencyKey: "rename-1-key",
    });
    const final = createOperation({
      operationId: "rename-2",
      payload: { name: "Final" },
      idempotencyKey: "rename-2-key",
      createdAt: "2026-06-10T10:01:00.000Z",
    });
    const repository = createRepository([first, final]);
    const transport = vi.fn(createEndpointTransport("user-1"));

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
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

  it("surfaces per-operation endpoint validation failures without retrying them", async () => {
    const repository = createRepository([
      createOperation({
        operationId: "oversized",
        idempotencyKey: "oversized-key",
        payload: {
          name: "x".repeat(SYNC_ENDPOINT_MAX_PAYLOAD_BYTES + 1),
        },
      }),
    ]);
    const transport = vi.fn(createEndpointTransport("user-1"));

    const replay = await flushOutboxOperationsBatch({
      userId: "user-1",
      transport,
      repository,
    });

    expect(repository.markOutboxOperationFailed).toHaveBeenCalledWith({
      operationId: "oversized",
      errorMessage: "Operation payload exceeds the sync endpoint size limit.",
    });
    expect(repository.incrementRetryCount).not.toHaveBeenCalled();
    expect(replay).toMatchObject({
      syncedCount: 0,
      failedCount: 1,
    });
  });
});
