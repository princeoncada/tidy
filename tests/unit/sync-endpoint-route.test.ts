import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

const { getUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

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

function createSyncRequest(body: unknown): Request {
  return new Request("http://localhost/api/sync", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function createEndpointRequest(operation = createOperation()) {
  return {
    operation,
    idempotencyKey: operation.idempotencyKey,
  };
}

describe("sync endpoint route", () => {
  beforeEach(() => {
    vi.resetModules();
    getUserMock.mockReset();
  });

  it("returns 401 when no user is authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest(createEndpointRequest()));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errors: ["Unauthorized."],
    });
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

  it("returns 200 for a valid operation owned by the authenticated user", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest(createEndpointRequest()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 422 when the operation user differs from the authenticated user", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-2" } } });
    const { POST } = await import("@/app/api/sync/route");

    const response = await POST(createSyncRequest(createEndpointRequest()));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errors: ["Operation user does not match authenticated user."],
    });
  });
});
