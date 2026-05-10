import { describe, expect, it } from "vitest";

import { createSyncStatusSurface } from "@/lib/sync/sync-status-surface";
import type { LocalOutboxOperationStatus } from "@/lib/local-db/outbox-schema";

function operation(status: LocalOutboxOperationStatus): { status: LocalOutboxOperationStatus } {
  return { status };
}

describe("sync status surface", () => {
  it("reports idle when there are no operations", () => {
    expect(createSyncStatusSurface([])).toEqual({
      state: "idle",
      label: "No sync activity",
      description: "No local sync operations have been queued.",
      counts: {
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        discarded: 0,
      },
      totalCount: 0,
      visibleCount: 0,
      hasActionableFailure: false,
    });
  });

  it("prioritizes failed operations because they need user or system recovery", () => {
    expect(
      createSyncStatusSurface([
        operation("pending"),
        operation("syncing"),
        operation("failed"),
        operation("failed"),
      ]),
    ).toMatchObject({
      state: "failed",
      label: "Sync failed",
      description: "2 operations need attention.",
      totalCount: 4,
      visibleCount: 4,
      hasActionableFailure: true,
    });
  });

  it("reports syncing when work is currently replaying and there are no failures", () => {
    expect(createSyncStatusSurface([operation("pending"), operation("syncing")])).toMatchObject({
      state: "syncing",
      label: "Syncing",
      description: "1 operation currently syncing.",
      totalCount: 2,
      visibleCount: 2,
      hasActionableFailure: false,
    });
  });

  it("reports pending when local operations are waiting to sync", () => {
    expect(createSyncStatusSurface([operation("pending"), operation("pending")])).toMatchObject({
      state: "pending",
      label: "Sync pending",
      description: "2 operations waiting to sync.",
      totalCount: 2,
      visibleCount: 2,
    });
  });

  it("reports synced when only synced or discarded operations remain", () => {
    expect(createSyncStatusSurface([operation("synced"), operation("discarded")])).toMatchObject({
      state: "synced",
      label: "Synced",
      description: "No pending sync work.",
      totalCount: 2,
      visibleCount: 0,
      hasActionableFailure: false,
    });
  });

  it("counts every outbox status separately", () => {
    expect(
      createSyncStatusSurface([
        operation("pending"),
        operation("syncing"),
        operation("synced"),
        operation("failed"),
        operation("discarded"),
      ]).counts,
    ).toEqual({
      pending: 1,
      syncing: 1,
      synced: 1,
      failed: 1,
      discarded: 1,
    });
  });

  it("uses singular copy for one failed, syncing, or pending operation", () => {
    expect(createSyncStatusSurface([operation("failed")]).description).toBe("1 operation needs attention.");
    expect(createSyncStatusSurface([operation("syncing")]).description).toBe("1 operation currently syncing.");
    expect(createSyncStatusSurface([operation("pending")]).description).toBe("1 operation waiting to sync.");
  });
});
