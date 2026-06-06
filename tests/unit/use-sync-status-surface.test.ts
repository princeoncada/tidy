import { act, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncStatusSurface } from "@/lib/sync/sync-status-surface";

const {
  isOfflineWriteCaptureEnabledMock,
  readSyncStatusSurfaceForUserMock,
  getUserMock,
} = vi.hoisted(() => ({
  isOfflineWriteCaptureEnabledMock: vi.fn(),
  readSyncStatusSurfaceForUserMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/sync/offline-write-prototype", () => ({
  isOfflineWriteCaptureEnabled: isOfflineWriteCaptureEnabledMock,
  readSyncStatusSurfaceForUser: readSyncStatusSurfaceForUserMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

const pendingSurface: SyncStatusSurface = {
  state: "pending",
  label: "Sync pending",
  description: "1 operation waiting to sync.",
  counts: {
    pending: 1,
    syncing: 0,
    synced: 0,
    failed: 0,
    discarded: 0,
  },
  totalCount: 1,
  visibleCount: 1,
  hasActionableFailure: false,
};

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function renderIsolatedSyncStatusSurface() {
  vi.resetModules();
  vi.doMock("react", () => React);
  const { useSyncStatusSurface } = await import("@/hooks/use-sync-status-surface");

  return renderHook(() => useSyncStatusSurface());
}

describe("sync status surface hook", () => {
  beforeEach(() => {
    isOfflineWriteCaptureEnabledMock.mockReset();
    readSyncStatusSurfaceForUserMock.mockReset();
    getUserMock.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stays null and does not read while the prototype gate is off", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(false);

    const { result } = await renderIsolatedSyncStatusSurface();
    await flushEffects();

    expect(result.current).toBeNull();
    expect(readSyncStatusSurfaceForUserMock).not.toHaveBeenCalled();
  });

  it("reads on mount for the browser-authenticated user", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    readSyncStatusSurfaceForUserMock.mockResolvedValue(pendingSurface);

    const { result } = await renderIsolatedSyncStatusSurface();

    await vi.waitFor(() => {
      expect(result.current).toEqual(pendingSurface);
    });
    expect(readSyncStatusSurfaceForUserMock).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("runs another read when the browser comes online", async () => {
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    readSyncStatusSurfaceForUserMock.mockResolvedValue(pendingSurface);

    const { unmount } = await renderIsolatedSyncStatusSurface();
    await vi.waitFor(() => {
      expect(readSyncStatusSurfaceForUserMock).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event("online"));

    await vi.waitFor(() => {
      expect(readSyncStatusSurfaceForUserMock).toHaveBeenCalledTimes(2);
    });

    unmount();
  });

  it("removes listeners and clears polling on unmount", async () => {
    vi.useFakeTimers();
    isOfflineWriteCaptureEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    readSyncStatusSurfaceForUserMock.mockResolvedValue(pendingSurface);

    const { unmount } = await renderIsolatedSyncStatusSurface();
    await act(async () => {
      await flushEffects();
    });
    expect(readSyncStatusSurfaceForUserMock).toHaveBeenCalledTimes(1);

    unmount();
    window.dispatchEvent(new Event("online"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await flushEffects();
    });

    expect(readSyncStatusSurfaceForUserMock).toHaveBeenCalledTimes(1);
  });
});
