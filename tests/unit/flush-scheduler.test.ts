import { describe, expect, it, vi } from "vitest";

import { createFlushScheduler } from "@/lib/sync/flush-scheduler";

type TimeoutHandle = ReturnType<typeof setTimeout>;

function createFakeClock() {
  let nextId = 1;
  const timers = new Map<
    number,
    { handler: () => void; timeoutMs: number }
  >();

  return {
    setTimeoutImpl: vi.fn((handler: () => void, timeoutMs: number) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { handler, timeoutMs });
      return id as unknown as TimeoutHandle;
    }),
    clearTimeoutImpl: vi.fn((handle: TimeoutHandle) => {
      timers.delete(handle as unknown as number);
    }),
    runNext() {
      const next = [...timers.entries()][0];
      if (!next) {
        throw new Error("Expected a pending timer.");
      }
      const [id, timer] = next;
      timers.delete(id);
      timer.handler();
    },
    get pendingCount() {
      return timers.size;
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("flush scheduler", () => {
  it("coalesces schedule signals inside one quiet window", async () => {
    const clock = createFakeClock();
    const flush = vi.fn(async () => undefined);
    const scheduler = createFlushScheduler({
      flush,
      quietWindowMs: 50,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(clock.pendingCount).toBe(1);
    expect(flush).not.toHaveBeenCalled();

    clock.runNext();
    await flushMicrotasks();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("flushes immediately at the batch-size threshold", async () => {
    const clock = createFakeClock();
    const flush = vi.fn(async () => undefined);
    const scheduler = createFlushScheduler({
      flush,
      quietWindowMs: 50,
      batchSizeThreshold: 3,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    await flushMicrotasks();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(clock.pendingCount).toBe(0);
  });

  it("suppresses concurrent flushes and re-arms once after completion", async () => {
    const clock = createFakeClock();
    let resolveFirst!: () => void;
    const firstFlush = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const flush = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstFlush)
      .mockResolvedValue(undefined);
    const scheduler = createFlushScheduler({
      flush,
      quietWindowMs: 50,
      batchSizeThreshold: 2,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    scheduler.flushNow();
    await flushMicrotasks();
    expect(flush).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    scheduler.schedule();
    expect(flush).toHaveBeenCalledTimes(1);

    resolveFirst();
    await flushMicrotasks();
    expect(clock.pendingCount).toBe(1);

    clock.runNext();
    await flushMicrotasks();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending quiet-window flush", async () => {
    const clock = createFakeClock();
    const flush = vi.fn(async () => undefined);
    const scheduler = createFlushScheduler({
      flush,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    scheduler.schedule();
    scheduler.cancel();
    await flushMicrotasks();

    expect(clock.pendingCount).toBe(0);
    expect(flush).not.toHaveBeenCalled();
  });
});
