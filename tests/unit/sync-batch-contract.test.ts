import { describe, expect, it } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  SYNC_BATCH_MAX_OPERATIONS,
  SYNC_BATCH_MAX_TOTAL_BYTES,
  validateSyncBatchRequest,
} from "@/lib/sync/sync-batch-contract";

function createOperation(
  overrides: Partial<LocalOutboxOperation> = {},
): LocalOutboxOperation {
  return {
    operationId: "op-1",
    userId: "user-1",
    entityType: "list",
    entityClientId: "list-1",
    entityServerId: null,
    operationType: "create",
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

function batchEntry(operation: LocalOutboxOperation) {
  return {
    operation,
    idempotencyKey: operation.idempotencyKey,
  };
}

describe("sync batch contract", () => {
  it("rejects invalid and empty envelopes", () => {
    expect(
      validateSyncBatchRequest(null, {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: false,
      errors: ["Sync batch request must be an object."],
    });

    expect(
      validateSyncBatchRequest({ operations: [] }, {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: false,
      errors: ["Sync batch operations must be a non-empty array."],
    });
  });

  it("rejects an empty authenticated user id", () => {
    expect(
      validateSyncBatchRequest({
        operations: [batchEntry(createOperation())],
      }, {
        authenticatedUserId: "",
      }),
    ).toEqual({
      ok: false,
      errors: ["Authenticated user id is required."],
    });
  });

  it("rejects batches over the operation count limit", () => {
    const operations = Array.from(
      { length: SYNC_BATCH_MAX_OPERATIONS + 1 },
      (_, index) => batchEntry(createOperation({
        operationId: `op-${index}`,
        entityClientId: `list-${index}`,
        idempotencyKey: `key-${index}`,
      })),
    );

    expect(
      validateSyncBatchRequest({ operations }, {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: false,
      errors: ["Sync batch exceeds the operation count limit."],
    });
  });

  it("rejects batches over the total payload limit", () => {
    const payloadSize = Math.floor(SYNC_BATCH_MAX_TOTAL_BYTES / 20);
    const operations = Array.from({ length: 21 }, (_, index) =>
      batchEntry(createOperation({
        operationId: `op-${index}`,
        entityClientId: `list-${index}`,
        idempotencyKey: `key-${index}`,
        payload: { name: "x".repeat(payloadSize) },
      })),
    );

    const result = validateSyncBatchRequest({ operations }, {
      authenticatedUserId: "user-1",
    });

    expect(result).toEqual({
      ok: false,
      errors: ["Sync batch exceeds the total payload size limit."],
    });
  });

  it("returns accepted and rejected decisions in submission order", () => {
    const accepted = createOperation();
    const rejected = createOperation({
      operationId: "op-2",
      entityClientId: "list-2",
      idempotencyKey: "op-2-key",
      userId: "user-2",
    });

    const result = validateSyncBatchRequest({
      operations: [batchEntry(accepted), batchEntry(rejected)],
    }, {
      authenticatedUserId: "user-1",
    });

    expect(result).toEqual({
      ok: true,
      decisions: [
        {
          operationId: "op-1",
          idempotencyKey: "op-1-key",
          accepted: true,
          operation: accepted,
        },
        {
          operationId: "op-2",
          idempotencyKey: "op-2-key",
          accepted: false,
          errors: ["Operation user does not match authenticated user."],
        },
      ],
    });
  });

  it("rejects a later duplicate idempotency key", () => {
    const first = createOperation();
    const duplicate = createOperation({
      operationId: "op-2",
      entityClientId: "list-2",
      idempotencyKey: first.idempotencyKey,
    });

    const result = validateSyncBatchRequest({
      operations: [batchEntry(first), batchEntry(duplicate)],
    }, {
      authenticatedUserId: "user-1",
    });

    expect(result).toMatchObject({
      ok: true,
      decisions: [
        { operationId: "op-1", accepted: true },
        {
          operationId: "op-2",
          accepted: false,
          errors: ["Duplicate idempotency key in batch."],
        },
      ],
    });
  });

  it("rejects a child whose parent create appears later", () => {
    const child = createOperation({
      operationId: "child-create",
      entityType: "listItem",
      entityClientId: "item-1",
      operationType: "create",
      payload: { name: "Task", listId: "list-1" },
      idempotencyKey: "child-create-key",
    });
    const parent = createOperation({
      operationId: "parent-create",
      idempotencyKey: "parent-create-key",
    });

    const result = validateSyncBatchRequest({
      operations: [batchEntry(child), batchEntry(parent)],
    }, {
      authenticatedUserId: "user-1",
    });

    expect(result).toMatchObject({
      ok: true,
      decisions: [
        {
          operationId: "child-create",
          accepted: false,
          errors: [
            "Dependency not satisfied: parent created later in batch.",
          ],
        },
        { operationId: "parent-create", accepted: true },
      ],
    });
  });

  it("accepts a child whose parent create appears earlier", () => {
    const parent = createOperation({
      operationId: "parent-create",
      idempotencyKey: "parent-create-key",
    });
    const child = createOperation({
      operationId: "child-create",
      entityType: "listItem",
      entityClientId: "item-1",
      operationType: "create",
      payload: { name: "Task", listId: "list-1" },
      idempotencyKey: "child-create-key",
    });

    const result = validateSyncBatchRequest({
      operations: [batchEntry(parent), batchEntry(child)],
    }, {
      authenticatedUserId: "user-1",
    });

    expect(result).toMatchObject({
      ok: true,
      decisions: [
        { operationId: "parent-create", accepted: true },
        { operationId: "child-create", accepted: true },
      ],
    });
  });
});
