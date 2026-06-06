import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SyncStatusBadge from "@/components/SyncStatusBadge";
import type { SyncStatusSurface } from "@/lib/sync/sync-status-surface";

const { useSyncStatusSurfaceMock } = vi.hoisted(() => ({
  useSyncStatusSurfaceMock: vi.fn(),
}));

vi.mock("@/hooks/use-sync-status-surface", () => ({
  useSyncStatusSurface: useSyncStatusSurfaceMock,
}));

function createSurface(
  overrides: Partial<SyncStatusSurface> = {},
): SyncStatusSurface {
  return {
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
    ...overrides,
  };
}

describe("sync status badge", () => {
  beforeEach(() => {
    useSyncStatusSurfaceMock.mockReset();
  });

  it("renders nothing when the surface is null", () => {
    useSyncStatusSurfaceMock.mockReturnValue(null);

    render(<SyncStatusBadge />);

    expect(screen.queryByTestId("sync-status-badge")).toBeNull();
  });

  it.each(["synced", "idle"] as const)(
    "renders nothing for %s with no visible work and no failure",
    (state) => {
      useSyncStatusSurfaceMock.mockReturnValue(
        createSurface({
          state,
          label: state === "synced" ? "Synced" : "No sync activity",
          description:
            state === "synced"
              ? "No pending sync work."
              : "No local sync operations have been queued.",
          counts: {
            pending: 0,
            syncing: 0,
            synced: state === "synced" ? 1 : 0,
            failed: 0,
            discarded: 0,
          },
          visibleCount: 0,
          hasActionableFailure: false,
        }),
      );

      render(<SyncStatusBadge />);

      expect(screen.queryByTestId("sync-status-badge")).toBeNull();
    },
  );

  it("renders pending status copy", () => {
    useSyncStatusSurfaceMock.mockReturnValue(createSurface());

    render(<SyncStatusBadge />);

    const badge = screen.getByTestId("sync-status-badge");
    expect(badge).toHaveAttribute("data-state", "pending");
    expect(screen.getByText("Sync pending")).toBeInTheDocument();
    expect(screen.getByText("1 operation waiting to sync.")).toBeInTheDocument();
  });

  it("renders syncing status state", () => {
    useSyncStatusSurfaceMock.mockReturnValue(
      createSurface({
        state: "syncing",
        label: "Syncing",
        description: "1 operation currently syncing.",
        counts: {
          pending: 0,
          syncing: 1,
          synced: 0,
          failed: 0,
          discarded: 0,
        },
      }),
    );

    render(<SyncStatusBadge />);

    expect(screen.getByTestId("sync-status-badge")).toHaveAttribute(
      "data-state",
      "syncing",
    );
  });

  it("renders failed status distinctly", () => {
    useSyncStatusSurfaceMock.mockReturnValue(
      createSurface({
        state: "failed",
        label: "Sync failed",
        description: "2 operations need attention.",
        counts: {
          pending: 0,
          syncing: 0,
          synced: 0,
          failed: 2,
          discarded: 0,
        },
        totalCount: 2,
        visibleCount: 2,
        hasActionableFailure: true,
      }),
    );

    render(<SyncStatusBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("data-state", "failed");
    expect(screen.getByTestId("sync-status-failed-count")).toHaveTextContent("2 failed");
  });
});
