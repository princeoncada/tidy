import { renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  isOfflineWriteCaptureEnabledMock,
  reconcilePendingWritesOnLoadMock,
  flushOfflineWritesMock,
  getUserMock,
  createFlushSchedulerMock,
  scheduleMock,
  flushNowMock,
  cancelMock,
  subscribeToOutboxCapturesMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  isOfflineWriteCaptureEnabledMock: vi.fn(),
  reconcilePendingWritesOnLoadMock: vi.fn(),
  flushOfflineWritesMock: vi.fn(),
  getUserMock: vi.fn(),
  createFlushSchedulerMock: vi.fn(),
  scheduleMock: vi.fn(),
  flushNowMock: vi.fn(),
  cancelMock: vi.fn(),
  subscribeToOutboxCapturesMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}));

vi.mock("@/lib/sync/offline-write-prototype", () => ({
  isOfflineWriteCaptureEnabled: isOfflineWriteCaptureEnabledMock,
  reconcilePendingWritesOnLoad: reconcilePendingWritesOnLoadMock,
  flushOfflineWrites: flushOfflineWritesMock,
}));

vi.mock("@/lib/sync/flush-scheduler", () => ({
  createFlushScheduler: createFlushSchedulerMock,
}));

vi.mock("@/lib/sync/outbox-capture-events", () => ({
  subscribeToOutboxCaptures: subscribeToOutboxCapturesMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function renderIsolatedOfflineReplayTrigger() {
  vi.resetModules();
  vi.doMock("react", () => React);
  const { useOfflineReplayTrigger } = await import(
    "@/hooks/use-offline-replay-trigger"
  );

  return renderHook(() => useOfflineReplayTrigger());
}

describe("offline replay trigger", () => {
  beforeEach(() => {
    isOfflineWriteCaptureEnabledMock.mockReset();
    reconcilePendingWritesOnLoadMock.mockReset();
    flushOfflineWritesMock.mockReset();
    getUserMock.mockReset();
    createFlushSchedulerMock.mockReset();
    scheduleMock.mockReset();
    flushNowMock.mockReset();
    cancelMock.mockReset();
    subscribeToOutboxCapturesMock.mockReset();
    unsubscribeMock.mockReset();

    createFlushSchedulerMock.mockReturnValue({
      schedule: scheduleMock,
      flushNow: flushNowMock,
      cancel: cancelMock,
    });
    subscribeToOutboxCapturesMock.mockReturnValue(unsubscribeMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not initialize while the prototype gate is off", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(false);

    await renderIsolatedOfflineReplayTrigger();
    await flushEffects();

    expect(createFlushSchedulerMock).not.toHaveBeenCalled();
    expect(reconcilePendingWritesOnLoadMock).not.toHaveBeenCalled();
  });

  it("reconciles the authenticated user before requesting the mount flush", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const calls: string[] = [];
    reconcilePendingWritesOnLoadMock.mockImplementation(async () => {
      calls.push("reconcile");
    });
    flushNowMock.mockImplementation(() => {
      calls.push("flush-now");
    });

    await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(flushNowMock).toHaveBeenCalledTimes(1);
    });

    expect(reconcilePendingWritesOnLoadMock).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(calls).toEqual(["reconcile", "flush-now"]);
  });

  it("schedules captures for the active user only", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);

    await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(flushNowMock).toHaveBeenCalledTimes(1);
    });

    const listener = subscribeToOutboxCapturesMock.mock.calls[0]?.[0] as
      | ((event: { userId: string }) => void)
      | undefined;
    expect(listener).toBeDefined();

    listener?.({ userId: "user-2" });
    listener?.({ userId: "user-1" });

    expect(scheduleMock).toHaveBeenCalledTimes(1);
  });

  it("requests immediate flushes on reconnect, hidden visibility, and pagehide", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);

    await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(flushNowMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event("online"));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));

    expect(flushNowMock).toHaveBeenCalledTimes(4);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(reconcilePendingWritesOnLoadMock).toHaveBeenCalledTimes(1);
  });

  it("runs the scheduler flush with the resolved user", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);
    flushOfflineWritesMock.mockResolvedValue(undefined);

    await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(createFlushSchedulerMock).toHaveBeenCalledTimes(1);
    });

    const flush = createFlushSchedulerMock.mock.calls[0]?.[0]?.flush as
      | (() => Promise<void>)
      | undefined;
    await flush?.();

    expect(flushOfflineWritesMock).toHaveBeenCalledWith({
      userId: "user-1",
    });
  });

  it("cleans up subscriptions, lifecycle listeners, and the scheduler", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);

    const { unmount } = await renderIsolatedOfflineReplayTrigger();
    await flushEffects();
    unmount();

    window.dispatchEvent(new Event("online"));

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(flushNowMock).toHaveBeenCalledTimes(1);
  });

  it("logs initialization failures", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockRejectedValue(new Error("Auth unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await renderIsolatedOfflineReplayTrigger();
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Offline replay initialization failed",
          expect.any(Error),
        );
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
