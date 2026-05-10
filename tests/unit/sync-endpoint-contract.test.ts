import { describe, expect, it } from "vitest";

import {
  SYNC_ENDPOINT_MAX_PAYLOAD_BYTES,
  validateSyncEndpointRequest,
} from "@/lib/sync/sync-endpoint-contract";
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
    status: "syncing",
    retryCount: 0,
    errorMessage: null,
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z",
    lastAttemptedAt: "2026-05-10T10:00:00.000Z",
    idempotencyKey: "op-1",
    ...overrides,
  };
}

function createRequest(operation = createOperation()) {
  return {
    operation,
    idempotencyKey: operation.idempotencyKey,
  };
}

describe("sync endpoint contract validation", () => {
  it("accepts a valid operation for the authenticated user", () => {
    expect(
      validateSyncEndpointRequest(createRequest(), {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: true,
      request: createRequest(),
    });
  });

  it("rejects non-object requests", () => {
    expect(
      validateSyncEndpointRequest(null, {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: false,
      errors: ["Sync endpoint request must be an object."],
    });
  });

  it("rejects invalid outbox operation shape", () => {
    expect(
      validateSyncEndpointRequest(
        {
          operation: createOperation({ operationId: "" }),
          idempotencyKey: "op-1",
        },
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Operation is not a valid outbox operation."],
    });
  });

  it("rejects operations for a different authenticated user", () => {
    const result = validateSyncEndpointRequest(createRequest(), {
      authenticatedUserId: "user-2",
    });

    expect(result).toEqual({
      ok: false,
      errors: ["Operation user does not match authenticated user."],
    });
  });

  it("rejects missing or mismatched idempotency keys", () => {
    expect(
      validateSyncEndpointRequest(
        {
          operation: createOperation({ idempotencyKey: "operation-key" }),
          idempotencyKey: "request-key",
        },
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Request idempotency key must match operation idempotency key."],
    });

    expect(
      validateSyncEndpointRequest(
        {
          operation: createOperation(),
          idempotencyKey: "",
        },
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: [
        "Idempotency key is required.",
        "Request idempotency key must match operation idempotency key.",
      ],
    });
  });

  it("rejects operations that are not pending or syncing", () => {
    expect(
      validateSyncEndpointRequest(createRequest(createOperation({ status: "synced" })), {
        authenticatedUserId: "user-1",
      }),
    ).toEqual({
      ok: false,
      errors: ["Only pending or syncing operations can be replayed."],
    });
  });

  it("rejects unsupported entity and operation combinations", () => {
    expect(
      validateSyncEndpointRequest(
        createRequest(
          createOperation({
            entityType: "tag",
            operationType: "move",
            payload: { targetClientId: "tag-2" },
          }),
        ),
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Operation type is not allowed for entity type."],
    });
  });

  it("rejects oversized payloads", () => {
    const result = validateSyncEndpointRequest(
      createRequest(
        createOperation({
          payload: { name: "x".repeat(SYNC_ENDPOINT_MAX_PAYLOAD_BYTES + 1) },
        }),
      ),
      { authenticatedUserId: "user-1" },
    );

    expect(result).toEqual({
      ok: false,
      errors: ["Operation payload exceeds the sync endpoint size limit."],
    });
  });

  it("requires payloads to be JSON objects", () => {
    expect(
      validateSyncEndpointRequest(
        createRequest(
          createOperation({
            payload: "rename",
          }),
        ),
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Operation payload must be a JSON object."],
    });
  });

  it("requires delete operations to include non-empty validation payload", () => {
    expect(
      validateSyncEndpointRequest(
        createRequest(
          createOperation({
            operationType: "delete",
            payload: {},
          }),
        ),
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Delete operations must include a non-empty payload for server validation."],
    });
  });

  it("requires move operations to include a target client id", () => {
    expect(
      validateSyncEndpointRequest(
        createRequest(
          createOperation({
            operationType: "move",
            payload: { position: 1 },
          }),
        ),
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Move operations must include a target client id."],
    });
  });

  it("requires reorder operations to include string ordered ids", () => {
    expect(
      validateSyncEndpointRequest(
        createRequest(
          createOperation({
            operationType: "reorder",
            payload: { orderedIds: ["a", 2] },
          }),
        ),
        { authenticatedUserId: "user-1" },
      ),
    ).toEqual({
      ok: false,
      errors: ["Reorder operations must include orderedIds as a string array."],
    });
  });
});
