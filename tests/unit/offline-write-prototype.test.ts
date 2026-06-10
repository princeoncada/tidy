import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureDashboardMutationOutbox,
  captureOfflineWrite,
  createHttpSyncBatchTransport,
  createHttpSyncReplayTransport,
  flushOfflineWrites,
  isOfflineWriteCaptureEnabled,
  reconcilePendingWritesOnLoad,
} from "@/lib/sync/offline-write-prototype";
import { isLocalOutboxOperation, type LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import {
  markOutboxOperationSynced,
  type LocalOutboxRepositoryDatabase,
} from "@/lib/local-db/outbox-repository";
import { validateSyncBatchRequest } from "@/lib/sync/sync-batch-contract";

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

function createOperationForTransport(): LocalOutboxOperation {
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
  };
}

function createEndpointFetch(authenticatedUserId: string): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const requestBody = typeof init?.body === "string" ? init.body : "{}";
    const request = JSON.parse(requestBody) as unknown;
    const result = validateSyncBatchRequest(request, {
      authenticatedUserId,
    });

    if (!result.ok) {
      return new Response(result.errors.join("; "), {
        status: 422,
      });
    }

    return Response.json({
      ok: true,
      results: result.decisions.map((decision) =>
        decision.accepted
          ? {
              operationId: decision.operationId,
              status: "applied",
              errorMessage: null,
            }
          : {
              operationId: decision.operationId,
              status: "rejected",
              errorMessage: decision.errors.join("; "),
            }),
    });
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("offline dashboard mutation capture gate", () => {
  it("enables dashboard capture only when the public prototype flag is true", () => {
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "");
    expect(isOfflineWriteCaptureEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "false");
    expect(isOfflineWriteCaptureEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");
    expect(isOfflineWriteCaptureEnabled()).toBe(true);
  });

  it("does not enqueue dashboard mutation outbox operations while the gate is off", async () => {
    const { db } = createFakeOutboxDb();

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "false");

    const result = await captureDashboardMutationOutbox(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        entityServerId: "server-list-1",
        operationType: "create",
        payload: { name: "Inbox", viewId: null },
      },
      { db },
    );

    expect(result).toBeNull();
    expect(db.outboxOperations.put).not.toHaveBeenCalled();
  });

  it("enqueues dashboard mutation outbox operations when the gate is on", async () => {
    const { db, store } = createFakeOutboxDb();

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");

    const result = await captureDashboardMutationOutbox(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        entityServerId: "server-list-1",
        operationType: "create",
        payload: { name: "Inbox", viewId: null },
      },
      { db },
    );

    expect(isLocalOutboxOperation(result)).toBe(true);
    expect(result?.status).toBe("pending");
    expect(db.outboxOperations.put).toHaveBeenCalledWith(result);
    expect(result ? store.get(result.operationId) : undefined).toEqual(result);
  });

  it("swallows dashboard mutation outbox capture failures when the gate is on", async () => {
    const { db } = createFakeOutboxDb();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");
    vi.mocked(db.outboxOperations.put).mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    await expect(
      captureDashboardMutationOutbox(
        {
          userId: "user-1",
          entityType: "list",
          entityClientId: "local-list-1",
          entityServerId: "server-list-1",
          operationType: "create",
          payload: { name: "Inbox", viewId: null },
        },
        { db },
      ),
    ).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to capture dashboard mutation outbox operation",
      expect.any(Error),
    );
  });
});

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

  it("posts a whole batch once and parses per-operation results", async () => {
    const operation = createOperationForTransport();
    const fetchImpl = vi.fn(async () => Response.json({
      ok: true,
      results: [{
        operationId: operation.operationId,
        status: "already-applied",
        errorMessage: null,
      }],
    }));
    const transport = createHttpSyncBatchTransport({
      endpoint: "/custom-sync",
      fetchImpl,
    });
    const request = {
      operations: [{
        operation,
        idempotencyKey: operation.idempotencyKey,
      }],
    };

    await expect(transport(request)).resolves.toEqual([{
      operationId: operation.operationId,
      status: "already-applied",
      errorMessage: null,
    }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/custom-sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
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
        payload: { toListClientId: "local-list-2", order: 0 },
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
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
      errorMessage: "Operation type is not allowed for entity type.",
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
    expect(readSource("lib/dashboard-cache.ts")).not.toMatch(/offline-write-prototype/);
    expect(readSource("trpc/client.tsx")).not.toMatch(/offline-write-prototype/);
  });

  it("wires durable pending-write backing into the optimistic sync hook", () => {
    expect(readSource("hooks/useOptimisticSync.ts")).toMatch(/offline-write-prototype/);
  });

  it("reconciles pending writes by user in createdAt order and survives reload", async () => {
    const { db, store } = createFakeOutboxDb();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");

    const userOneLater = await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "create",
        payload: { name: "Inbox" },
      },
      { db },
    );
    const userOneEarlier = await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-2",
        operationType: "create",
        payload: { name: "Today" },
      },
      { db },
    );
    await captureOfflineWrite(
      {
        userId: "user-2",
        entityType: "list",
        entityClientId: "local-list-3",
        operationType: "create",
        payload: { name: "Other user" },
      },
      { db },
    );

    const earlier = {
      ...userOneEarlier,
      createdAt: "2026-05-10T10:00:00.000Z",
      updatedAt: "2026-05-10T10:00:00.000Z",
    };
    const later = {
      ...userOneLater,
      createdAt: "2026-05-10T10:00:01.000Z",
      updatedAt: "2026-05-10T10:00:01.000Z",
    };
    store.set(earlier.operationId, earlier);
    store.set(later.operationId, later);

    const firstLoad = await reconcilePendingWritesOnLoad({ userId: "user-1", db });
    const simulatedReload = await reconcilePendingWritesOnLoad({ userId: "user-1", db });

    expect(firstLoad).toEqual([earlier, later]);
    expect(simulatedReload).toEqual([earlier, later]);
  });

  it("excludes non-pending writes from load reconciliation", async () => {
    const { db } = createFakeOutboxDb();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");

    const syncedOperation = await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "create",
        payload: { name: "Inbox" },
      },
      { db },
    );
    const pendingOperation = await captureOfflineWrite(
      {
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-2",
        operationType: "create",
        payload: { name: "Today" },
      },
      { db },
    );

    await markOutboxOperationSynced({
      operationId: syncedOperation.operationId,
      db,
    });

    const reconciled = await reconcilePendingWritesOnLoad({ userId: "user-1", db });

    expect(reconciled).toEqual([pendingOperation]);
  });

  it("returns no pending writes and performs no read while the gate is off", async () => {
    const { db } = createFakeOutboxDb();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "false");

    const reconciled = await reconcilePendingWritesOnLoad({ userId: "user-1", db });

    expect(reconciled).toEqual([]);
    expect(db.outboxOperations.where).not.toHaveBeenCalled();
  });
});
