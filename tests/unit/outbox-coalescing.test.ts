import { describe, expect, it } from "vitest";

import { coalesceOutboxOperations } from "@/lib/local-db/outbox-coalescing";
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

function operationIds(operations: LocalOutboxOperation[]): string[] {
  return operations.map((operation) => operation.operationId);
}

describe("outbox coalescing", () => {
  it("returns empty output for an empty queue", () => {
    expect(coalesceOutboxOperations([])).toEqual({
      operations: [],
      discardedOperationIds: [],
    });
  });

  it("collapses multiple updates on the same entity to the latest update", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "rename-1",
        payload: { name: "Inbox draft" },
        idempotencyKey: "rename-1",
      }),
      createOperation({
        operationId: "rename-2",
        payload: { name: "Inbox final" },
        updatedAt: "2026-05-10T10:01:00.000Z",
        idempotencyKey: "rename-2",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["rename-2"]);
    expect(result.operations[0]?.payload).toEqual({ name: "Inbox final" });
    expect(result.discardedOperationIds).toEqual(["rename-1"]);
  });

  it("collapses multiple reorders on the same entity to the final order payload", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "reorder-1",
        operationType: "reorder",
        payload: { orderedIds: ["a", "b", "c"] },
        idempotencyKey: "reorder-1",
      }),
      createOperation({
        operationId: "reorder-2",
        operationType: "reorder",
        payload: { orderedIds: ["c", "a", "b"] },
        idempotencyKey: "reorder-2",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["reorder-2"]);
    expect(result.operations[0]?.payload).toEqual({ orderedIds: ["c", "a", "b"] });
    expect(result.discardedOperationIds).toEqual(["reorder-1"]);
  });

  it("keeps only the final visible state for move plus reorder", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "move-1",
        operationType: "move",
        entityType: "listItem",
        entityClientId: "local-item-1",
        payload: { toListClientId: "local-list-2", position: 0 },
        idempotencyKey: "move-1",
      }),
      createOperation({
        operationId: "reorder-1",
        operationType: "reorder",
        entityType: "listItem",
        entityClientId: "local-item-1",
        payload: { listClientId: "local-list-2", orderedIds: ["local-item-2", "local-item-1"] },
        idempotencyKey: "reorder-1",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["reorder-1"]);
    expect(result.operations[0]?.payload).toEqual({
      listClientId: "local-list-2",
      orderedIds: ["local-item-2", "local-item-1"],
    });
    expect(result.discardedOperationIds).toEqual(["move-1"]);
  });

  it("keeps the later move when a move supersedes a reorder", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "reorder-1",
        operationType: "reorder",
        entityType: "listItem",
        entityClientId: "local-item-1",
        payload: { listClientId: "local-list-1", orderedIds: ["local-item-1"] },
        idempotencyKey: "reorder-1",
      }),
      createOperation({
        operationId: "move-1",
        operationType: "move",
        entityType: "listItem",
        entityClientId: "local-item-1",
        payload: { toListClientId: "local-list-2", position: 0 },
        idempotencyKey: "move-1",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["move-1"]);
    expect(result.discardedOperationIds).toEqual(["reorder-1"]);
  });

  it("replaces pending updates with delete for the same entity", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "rename-1",
        payload: { name: "Temporary name" },
        idempotencyKey: "rename-1",
      }),
      createOperation({
        operationId: "delete-1",
        operationType: "delete",
        payload: { deletedAt: "2026-05-10T10:02:00.000Z" },
        idempotencyKey: "delete-1",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["delete-1"]);
    expect(result.discardedOperationIds).toEqual(["rename-1"]);
  });

  it("discards create followed by delete when the entity was never synced", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "create-1",
        entityServerId: null,
        operationType: "create",
        payload: { name: "Draft list" },
        idempotencyKey: "create-1",
      }),
      createOperation({
        operationId: "delete-1",
        entityServerId: null,
        operationType: "delete",
        payload: { deletedAt: "2026-05-10T10:02:00.000Z" },
        idempotencyKey: "delete-1",
      }),
    ]);

    expect(result.operations).toEqual([]);
    expect(result.discardedOperationIds).toEqual(["create-1", "delete-1"]);
  });

  it("keeps delete after create when the entity has a server id", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "create-1",
        operationType: "create",
        idempotencyKey: "create-1",
      }),
      createOperation({
        operationId: "delete-1",
        operationType: "delete",
        payload: { deletedAt: "2026-05-10T10:02:00.000Z" },
        idempotencyKey: "delete-1",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["create-1", "delete-1"]);
    expect(result.discardedOperationIds).toEqual([]);
  });

  it("does not coalesce operations for different users or entities", () => {
    const result = coalesceOutboxOperations([
      createOperation({ operationId: "user-1-update", idempotencyKey: "user-1-update" }),
      createOperation({
        operationId: "user-2-update",
        userId: "user-2",
        idempotencyKey: "user-2-update",
      }),
      createOperation({
        operationId: "other-list-update",
        entityClientId: "local-list-2",
        idempotencyKey: "other-list-update",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual([
      "user-1-update",
      "user-2-update",
      "other-list-update",
    ]);
    expect(result.discardedOperationIds).toEqual([]);
  });

  it("does not coalesce non-pending operations", () => {
    const result = coalesceOutboxOperations([
      createOperation({
        operationId: "syncing-update",
        status: "syncing",
        idempotencyKey: "syncing-update",
      }),
      createOperation({
        operationId: "pending-update",
        payload: { name: "Pending name" },
        idempotencyKey: "pending-update",
      }),
    ]);

    expect(operationIds(result.operations)).toEqual(["syncing-update", "pending-update"]);
    expect(result.discardedOperationIds).toEqual([]);
  });

  it("does not mutate the input operations", () => {
    const first = createOperation({
      operationId: "rename-1",
      payload: { name: "Inbox draft" },
      idempotencyKey: "rename-1",
    });
    const second = createOperation({
      operationId: "rename-2",
      payload: { name: "Inbox final" },
      idempotencyKey: "rename-2",
    });
    const input = [first, second];

    coalesceOutboxOperations(input);

    expect(input).toEqual([first, second]);
  });
});
