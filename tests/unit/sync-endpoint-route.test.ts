import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

const { applySyncOperationsMock, getUserMock } = vi.hoisted(() => ({
  applySyncOperationsMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/lib/sync/server-apply", () => ({
  applySyncOperations: applySyncOperationsMock,
}));

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

function createSyncRequest(body: unknown): Request {
  return new Request("http://localhost/api/sync", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function batchEntry(operation: LocalOutboxOperation) {
  return {
    operation,
    idempotencyKey: operation.idempotencyKey,
  };
}

describe("sync endpoint route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
    applySyncOperationsMock.mockReset();
  });

  it("returns 401 when no user is authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest({
      operations: [batchEntry(createOperation())],
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errors: ["Unauthorized."],
    });
    expect(applySyncOperationsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errors: ["Request body must be valid JSON."],
    });
  });

  it("returns 422 for an invalid batch envelope", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest({ operations: [] }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errors: ["Sync batch operations must be a non-empty array."],
    });
    expect(applySyncOperationsMock).not.toHaveBeenCalled();
  });

  it("applies accepted operations and preserves mixed result order", async () => {
    const first = createOperation();
    const rejected = createOperation({
      operationId: "op-2",
      entityClientId: "list-2",
      userId: "user-2",
      idempotencyKey: "op-2-key",
    });
    const third = createOperation({
      operationId: "op-3",
      entityClientId: "list-3",
      idempotencyKey: "op-3-key",
    });
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    applySyncOperationsMock.mockResolvedValueOnce([
      {
        operationId: "op-1",
        status: "applied",
        errorMessage: null,
      },
      {
        operationId: "op-3",
        status: "already-applied",
        errorMessage: null,
      },
    ]);
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest({
      operations: [
        batchEntry(first),
        batchEntry(rejected),
        batchEntry(third),
      ],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: [
        {
          operationId: "op-1",
          status: "applied",
          errorMessage: null,
        },
        {
          operationId: "op-2",
          status: "rejected",
          errorMessage: "Operation user does not match authenticated user.",
        },
        {
          operationId: "op-3",
          status: "already-applied",
          errorMessage: null,
        },
      ],
    });
    expect(applySyncOperationsMock).toHaveBeenCalledWith({
      userId: "user-1",
      decisions: [
        expect.objectContaining({
          operationId: "op-1",
          accepted: true,
        }),
        expect.objectContaining({
          operationId: "op-3",
          accepted: true,
        }),
      ],
    });
  });

  it("reports every accepted operation failed when the atomic apply throws", async () => {
    const accepted = createOperation();
    const rejected = createOperation({
      operationId: "op-2",
      entityClientId: "list-2",
      userId: "user-2",
      idempotencyKey: "op-2-key",
    });
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    applySyncOperationsMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest({
      operations: [batchEntry(accepted), batchEntry(rejected)],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: [
        {
          operationId: "op-1",
          status: "failed",
          errorMessage: "database unavailable",
        },
        {
          operationId: "op-2",
          status: "rejected",
          errorMessage: "Operation user does not match authenticated user.",
        },
      ],
    });
  });
});
