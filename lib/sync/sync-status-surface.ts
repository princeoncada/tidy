import type { LocalOutboxOperation, LocalOutboxOperationStatus } from "@/lib/local-db/outbox-schema";

export type SyncStatusSurfaceState =
  | "idle"
  | "synced"
  | "pending"
  | "syncing"
  | "failed";

export type SyncStatusSurfaceCounts = Record<LocalOutboxOperationStatus, number>;

export type SyncStatusSurface = {
  state: SyncStatusSurfaceState;
  label: string;
  description: string;
  counts: SyncStatusSurfaceCounts;
  totalCount: number;
  visibleCount: number;
  hasActionableFailure: boolean;
};

function createEmptyCounts(): SyncStatusSurfaceCounts {
  return {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    discarded: 0,
  };
}

function getVisibleCount(counts: SyncStatusSurfaceCounts): number {
  return counts.pending + counts.syncing + counts.failed;
}

function getSurfaceCopy(counts: SyncStatusSurfaceCounts): Pick<SyncStatusSurface, "state" | "label" | "description"> {
  if (counts.failed > 0) {
    return {
      state: "failed",
      label: "Sync failed",
      description: `${counts.failed} operation${counts.failed === 1 ? " needs" : "s need"} attention.`,
    };
  }

  if (counts.syncing > 0) {
    return {
      state: "syncing",
      label: "Syncing",
      description: `${counts.syncing} operation${counts.syncing === 1 ? "" : "s"} currently syncing.`,
    };
  }

  if (counts.pending > 0) {
    return {
      state: "pending",
      label: "Sync pending",
      description: `${counts.pending} operation${counts.pending === 1 ? "" : "s"} waiting to sync.`,
    };
  }

  if (counts.synced > 0 || counts.discarded > 0) {
    return {
      state: "synced",
      label: "Synced",
      description: "No pending sync work.",
    };
  }

  return {
    state: "idle",
    label: "No sync activity",
    description: "No local sync operations have been queued.",
  };
}

export function createSyncStatusSurface(
  operations: readonly Pick<LocalOutboxOperation, "status">[],
): SyncStatusSurface {
  const counts = createEmptyCounts();

  for (const operation of operations) {
    counts[operation.status] += 1;
  }

  const copy = getSurfaceCopy(counts);
  const totalCount = Object.values(counts).reduce((total, count) => total + count, 0);

  return {
    ...copy,
    counts,
    totalCount,
    visibleCount: getVisibleCount(counts),
    hasActionableFailure: counts.failed > 0,
  };
}
