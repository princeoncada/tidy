import { renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocalOutboxRepositoryDatabase } from "@/lib/local-db/outbox-repository";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { OfflineWriteIntent } from "@/lib/sync/offline-write-prototype";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

type StoredOperation = LocalOutboxOperation;

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderIsolatedOptimisticSync() {
  vi.resetModules();
  vi.doMock("react", () => React);
  const { useOptimisticSync } = await import("@/hooks/useOptimisticSync");

  return renderHook(() => useOptimisticSync());
}

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

function createListIntent(): OfflineWriteIntent {
  return {
    userId: "user-1",
    entityType: "list",
    entityClientId: "local-list-1",
    operationType: "create",
    payload: { name: "Inbox" },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("optimistic sync durable pending-write backing", () => {
  it("marks the durable operation synced after a successful task with the default-on gate", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const { db, store } = createFakeOutboxDb();
    const task = vi.fn(async () => undefined);

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "");

    await result.current.enqueue("list-edits", task, {
      durable: {
        intent: createListIntent(),
        db,
      },
    });

    expect(task).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      const operations = [...store.values()];
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        userId: "user-1",
        entityType: "list",
        entityClientId: "local-list-1",
        operationType: "create",
        status: "synced",
        errorMessage: null,
      });
    });
  });

  it("marks the durable operation failed and preserves rollback behavior after a failed task", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const { db, store } = createFakeOutboxDb();
    const rollback = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");

    try {
      await result.current.enqueue(
        "list-edits",
        async () => {
          throw new Error("server rejected create");
        },
        {
          label: "create list",
          rollback,
          durable: {
            intent: createListIntent(),
            db,
          },
        },
      );

      expect(rollback).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        const operations = [...store.values()];
        expect(operations).toHaveLength(1);
        expect(operations[0]).toMatchObject({
          status: "failed",
          errorMessage: "server rejected create",
        });
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not persist durable operations while the gate is off", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const { db, store } = createFakeOutboxDb();
    const task = vi.fn(async () => undefined);

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "false");

    await result.current.enqueue("list-edits", task, {
      durable: {
        intent: createListIntent(),
        db,
      },
    });

    expect(task).toHaveBeenCalledTimes(1);
    expect([...store.values()]).toEqual([]);
  });

  it("keeps FIFO ordering unchanged when no durable option is provided", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const { store } = createFakeOutboxDb();
    const first = deferred();
    const second = deferred();
    const events: string[] = [];

    vi.stubEnv("NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED", "true");

    const firstPromise = result.current.enqueue("list-edits", async () => {
      events.push("first-start");
      await first.promise;
      events.push("first-end");
    });
    const secondPromise = result.current.enqueue("list-edits", async () => {
      events.push("second-start");
      await second.promise;
      events.push("second-end");
    });

    await flushMicrotasks();

    expect(events).toEqual(["first-start"]);

    first.resolve();
    await firstPromise;
    await flushMicrotasks();

    expect(events).toEqual(["first-start", "first-end", "second-start"]);

    second.resolve();
    await secondPromise;

    expect(events).toEqual([
      "first-start",
      "first-end",
      "second-start",
      "second-end",
    ]);
    expect([...store.values()]).toEqual([]);
  });
});
