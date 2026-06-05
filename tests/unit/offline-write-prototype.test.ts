import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  captureOfflineWrite,
  createHttpSyncReplayTransport,
  flushOfflineWrites,
} from "@/lib/sync/offline-write-prototype";
import { isLocalOutboxOperation, type LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { LocalOutboxRepositoryDatabase } from "@/lib/local-db/outbox-repository";
import { validateSyncEndpointRequest } from "@/lib/sync/sync-endpoint-contract";

type StoredOperation = LocalOutboxOperation;

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

function createFakeOutboxDb() {
  const store = new Map<string, StoredOperation>();

  const db: LocalOutboxRepositoryDatabase = {
    outboxOperations: {
      put: vi.fn(async (operation: LocalOutboxOperation) => {
        store.set(operation.operationId, operation);
        return operation.operationId;
      }),
      get: vi.fn(async (operationId: string) => store.get(operationId)),
      where: vi.fn(() => ({
        equals: vi.fn((value: unknown) => ({
          sortBy: vi.fn(async (fieldName: string) => {
            const [userId, status] = Array.isArray(value) ? value : [];

            return [...store.values()]
              .filter((operation) => operation.userId === userId && operation.status === status)
              .sort((left, right) => {
                const leftValue = left[fieldName as keyof LocalOutboxOperation];
                const rightValue = right[fieldName as keyof LocalOutboxOperation];

                return String(leftValue).localeCompare(String(rightValue));
              });
          }),
        })),
      })),
    },
  };

  return {
    db,
    store,
  };
}

function createOkResponse(): Response {
  return new Response("", {
    status: 200,
  });
}

function createEndpointFetch(authenticatedUserId: string): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const requestBody = typeof init?.body === "string" ? init.body : "{}";
    const request = JSON.parse(requestBody) as unknown;
    const result = validateSyncEndpointRequest(request, {
      authenticatedUserId,
    });

    if (!result.ok) {
      return new Response(result.errors.join("; "), {
        status: 400,
      });
    }

    return createOkResponse();
  });
}

describe("offline write prototype", () => {
  it("captures an offline write as a pending outbox operation in an injected db", async () => {
    const { db, store } = createFakeOutboxDb();

    const operation = await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "update",
        payload: { name: "Inbox" },
      },
      { db },
    );

    expect(isLocalOutboxOperation(operation)).toBe(true);
    expect(operation.status).toBe("pending");
    expect(operation.idempotencyKey.length).toBeGreaterThan(0);
    expect(db.outboxOperations.put).toHaveBeenCalledWith(operation);
    expect(store.get(operation.operationId)).toEqual(operation);
  });

  it("posts replay requests as JSON and resolves on ok responses", async () => {
    const operation = {
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
    } satisfies LocalOutboxOperation;
    const fetchImpl = vi.fn(async () => createOkResponse());
    const transport = createHttpSyncReplayTransport({
      endpoint: "/custom-sync",
      fetchImpl,
    });

    await transport({
      operation,
      idempotencyKey: operation.idempotencyKey,
    });

    expect(fetchImpl).toHaveBeenCalledWith("/custom-sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation,
        idempotencyKey: operation.idempotencyKey,
      }),
    });
  });

  it("throws status and body text for non-ok HTTP responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("Bad sync request", { status: 422 }));
    const transport = createHttpSyncReplayTransport({
      fetchImpl,
    });

    await expect(
      transport({
        operation: {
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
        },
        idempotencyKey: "op-1",
      }),
    ).rejects.toThrow("Sync replay HTTP 422: Bad sync request");
  });

  it("captures and flushes valid writes through the endpoint-backed HTTP transport", async () => {
    const { db } = createFakeOutboxDb();
    const fetchImpl = createEndpointFetch("user-1");

    await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "update",
        payload: { name: "Inbox" },
      },
      { db },
    );
    await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "listItem",
        entityClientId: "local-item-1",
        entityServerId: "server-item-1",
        operationType: "move",
        payload: { toListClientId: "local-list-2" },
      },
      { db },
    );

    const result = await flushOfflineWrites({
      userId: "user-1",
      fetchImpl,
      db,
    });

    expect(result).toMatchObject({
      syncedCount: 2,
      failedCount: 0,
    });
  });

  it("marks endpoint-rejected writes failed without blocking later valid writes", async () => {
    const { db } = createFakeOutboxDb();
    const fetchImpl = createEndpointFetch("user-1");

    await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "tag",
        entityClientId: "local-tag-1",
        operationType: "move",
        payload: { targetClientId: "local-tag-2" },
      },
      { db },
    );
    await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "update",
        payload: { name: "Today" },
      },
      { db },
    );

    const result = await flushOfflineWrites({
      userId: "user-1",
      fetchImpl,
      db,
    });

    expect(result).toMatchObject({
      failedCount: 1,
      syncedCount: 1,
    });
    expect(result.results[0]).toMatchObject({
      status: "failed",
      errorMessage: "Sync replay HTTP 400: Operation type is not allowed for entity type.",
    });
    expect(result.results[1]).toMatchObject({
      status: "synced",
      errorMessage: null,
    });
  });

  it("records offline fetch failures in the replay summary", async () => {
    const { db } = createFakeOutboxDb();
    const fetchImpl = vi.fn(async () => {
      throw new Error("Network unavailable");
    });

    await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "update",
        payload: { name: "Inbox" },
      },
      { db },
    );

    const result = await flushOfflineWrites({
      userId: "user-1",
      fetchImpl,
      db,
    });

    expect(result).toMatchObject({
      failedCount: 1,
      syncedCount: 0,
    });
    expect(result.results[0]).toMatchObject({
      status: "failed",
      errorMessage: "Network unavailable",
    });
  });

  it("does not import the prototype from runtime dashboard entry points", () => {
    expect(readSource("hooks/useOptimisticSync.ts")).not.toMatch(/offline-write-prototype/);
    expect(readSource("lib/dashboard-cache.ts")).not.toMatch(/offline-write-prototype/);
    expect(readSource("trpc/client.tsx")).not.toMatch(/offline-write-prototype/);
  });
});
