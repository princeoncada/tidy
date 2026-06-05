import { renderHook } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve!: () => void;

  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
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

describe("optimistic sync queue baseline", () => {
  it("runs tasks enqueued to the same scope sequentially in FIFO order", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const first = deferred();
    const second = deferred();
    const events: string[] = [];

    const firstPromise = result.current.enqueue("views", async () => {
      events.push("first-start");
      await first.promise;
      events.push("first-end");
    });
    const secondPromise = result.current.enqueue("views", async () => {
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
  });

  it("does not block independent scopes behind a slow task", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const slow = deferred();
    const events: string[] = [];

    const slowPromise = result.current.enqueue("views", async () => {
      events.push("slow-start");
      await slow.promise;
      events.push("slow-end");
    });
    const fastPromise = result.current.enqueue("list-tags", async () => {
      events.push("fast");
    });

    await fastPromise;

    expect(events).toEqual(["slow-start", "fast"]);

    slow.resolve();
    await slowPromise;

    expect(events).toEqual(["slow-start", "fast", "slow-end"]);
  });

  it("replacePending cancels pending same-scope entries so newest state wins", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const active = deferred();
    const events: string[] = [];

    const activePromise = result.current.enqueue("list-order", async () => {
      events.push("active-start");
      await active.promise;
      events.push("active-end");
    });
    await flushMicrotasks();

    const skippedPromise = result.current.enqueue("list-order", async () => {
      events.push("skipped");
    });
    const newestPromise = result.current.replacePending("list-order", async () => {
      events.push("newest");
    });

    await newestPromise;

    expect(events).toEqual(["active-start", "newest"]);

    active.resolve();
    await activePromise;
    await skippedPromise;

    expect(events).toEqual(["active-start", "newest", "active-end"]);
  });

  it("rolls back failed tasks once, cancels the scope, and logs the failure", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const rollback = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const events: string[] = [];

    try {
      const failedPromise = result.current.enqueue(
        "list-edits",
        async () => {
          events.push("failed");
          throw new Error("server rejected rename");
        },
        { label: "rename list", rollback }
      );
      const skippedPromise = result.current.enqueue("list-edits", async () => {
        events.push("skipped");
      });

      await failedPromise;
      await skippedPromise;

      expect(events).toEqual(["failed"]);
      expect(rollback).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Optimistic sync failed:",
        expect.objectContaining({
          scope: "list-edits",
          label: "rename list",
        })
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not roll back CancelledError rejections", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const rollback = vi.fn();

    await result.current.enqueue(
      "item-edits",
      async () => {
        throw new Error("CancelledError");
      },
      { rollback }
    );

    expect(rollback).not.toHaveBeenCalled();
  });

  it("cancelScope skips queued tasks that have not started and resets the chain", async () => {
    const { result } = await renderIsolatedOptimisticSync();
    const active = deferred();
    const events: string[] = [];

    const activePromise = result.current.enqueue("item-order", async () => {
      events.push("active-start");
      await active.promise;
      events.push("active-end");
    });
    await flushMicrotasks();

    const skippedPromise = result.current.enqueue("item-order", async () => {
      events.push("skipped");
    });

    result.current.cancelScope("item-order");

    const afterCancelPromise = result.current.enqueue("item-order", async () => {
      events.push("after-cancel");
    });

    await afterCancelPromise;

    expect(events).toEqual(["active-start", "after-cancel"]);

    active.resolve();
    await activePromise;
    await skippedPromise;

    expect(events).toEqual(["active-start", "after-cancel", "active-end"]);
  });

  it("documents the known module-level queue state shared across hook instances", async () => {
    vi.resetModules();
    vi.doMock("react", () => React);
    const { useOptimisticSync } = await import("@/hooks/useOptimisticSync");
    const active = deferred();
    const events: string[] = [];

    const firstHook = renderHook(() => useOptimisticSync());
    const activePromise = firstHook.result.current.enqueue("views", async () => {
      events.push("first-instance-start");
      await active.promise;
      events.push("first-instance-end");
    });

    await flushMicrotasks();
    firstHook.unmount();

    const secondHook = renderHook(() => useOptimisticSync());
    const secondPromise = secondHook.result.current.enqueue("views", async () => {
      events.push("second-instance");
    });

    await flushMicrotasks();

    // Known race risk for 1.7.1/1.7.2: chains and entries are module-level
    // singletons, so the second mount remains behind the first mount's queue.
    expect(events).toEqual(["first-instance-start"]);

    active.resolve();
    await activePromise;
    await secondPromise;

    expect(events).toEqual([
      "first-instance-start",
      "first-instance-end",
      "second-instance",
    ]);
  });
});
