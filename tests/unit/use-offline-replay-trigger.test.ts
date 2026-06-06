import { renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  isOfflineWriteCaptureEnabledMock,
  reconcilePendingWritesOnLoadMock,
  flushOfflineWritesMock,
  getUserMock,
} = vi.hoisted(() => ({
  isOfflineWriteCaptureEnabledMock: vi.fn(),
  reconcilePendingWritesOnLoadMock: vi.fn(),
  flushOfflineWritesMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/sync/offline-write-prototype", () => ({
  isOfflineWriteCaptureEnabled: isOfflineWriteCaptureEnabledMock,
  reconcilePendingWritesOnLoad: reconcilePendingWritesOnLoadMock,
  flushOfflineWrites: flushOfflineWritesMock,
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
  const { useOfflineReplayTrigger } = await import("@/hooks/use-offline-replay-trigger");

  return renderHook(() => useOfflineReplayTrigger());
}

describe("offline replay trigger", () => {
  beforeEach(() => {
    isOfflineWriteCaptureEnabledMock.mockReset();
    reconcilePendingWritesOnLoadMock.mockReset();
    flushOfflineWritesMock.mockReset();
    getUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not run replay while the prototype gate is off", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(false);

    await renderIsolatedOfflineReplayTrigger();
    await flushEffects();

    expect(reconcilePendingWritesOnLoadMock).not.toHaveBeenCalled();
    expect(flushOfflineWritesMock).not.toHaveBeenCalled();
  });

  it("runs reconcile then flush for the browser-authenticated user on mount", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const calls: string[] = [];
    reconcilePendingWritesOnLoadMock.mockImplementation(async () => {
      calls.push("reconcile");
    });
    flushOfflineWritesMock.mockImplementation(async () => {
      calls.push("flush");
    });

    await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(flushOfflineWritesMock).toHaveBeenCalledWith({ userId: "user-1" });
    });

    expect(reconcilePendingWritesOnLoadMock).toHaveBeenCalledWith({ userId: "user-1" });
    expect(calls).toEqual(["reconcile", "flush"]);
  });

  it("does not run replay when no browser user is available", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: null } });

    await renderIsolatedOfflineReplayTrigger();
    await flushEffects();

    expect(reconcilePendingWritesOnLoadMock).not.toHaveBeenCalled();
    expect(flushOfflineWritesMock).not.toHaveBeenCalled();
  });

  it("runs another replay when the browser comes online", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);
    flushOfflineWritesMock.mockResolvedValue(undefined);

    const { unmount } = await renderIsolatedOfflineReplayTrigger();
    await vi.waitFor(() => {
      expect(flushOfflineWritesMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event("online"));

    await vi.waitFor(() => {
      expect(flushOfflineWritesMock).toHaveBeenCalledTimes(2);
    });
    expect(reconcilePendingWritesOnLoadMock).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("swallows replay failures", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reconcilePendingWritesOnLoadMock.mockResolvedValue([]);
    flushOfflineWritesMock.mockRejectedValue(new Error("Network unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(renderIsolatedOfflineReplayTrigger()).resolves.toBeDefined();
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Offline replay trigger failed",
          expect.any(Error),
        );
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
