import { describe, expect, it } from "vitest";

import {
  isLocalSyncStatus,
  isOutboxOperationStatus,
  isRetryableOutboxOperationStatus,
  isTerminalLocalSyncStatus,
  isTerminalOutboxOperationStatus,
  LOCAL_SYNC_STATUSES,
  OUTBOX_OPERATION_STATUSES,
} from "@/lib/local-db/sync-status";

describe("sync status model", () => {
  it("exposes the supported local entity statuses in workflow order", () => {
    expect(LOCAL_SYNC_STATUSES).toEqual(["local", "pending", "syncing", "synced", "failed"]);
  });

  it("exposes the supported outbox operation statuses in workflow order", () => {
    expect(OUTBOX_OPERATION_STATUSES).toEqual(["pending", "syncing", "synced", "failed", "discarded"]);
  });

  it("guards local sync status values", () => {
    expect(isLocalSyncStatus("local")).toBe(true);
    expect(isLocalSyncStatus("pending")).toBe(true);
    expect(isLocalSyncStatus("discarded")).toBe(false);
    expect(isLocalSyncStatus(null)).toBe(false);
    expect(isLocalSyncStatus(undefined)).toBe(false);
  });

  it("guards outbox operation status values", () => {
    expect(isOutboxOperationStatus("pending")).toBe(true);
    expect(isOutboxOperationStatus("discarded")).toBe(true);
    expect(isOutboxOperationStatus("local")).toBe(false);
    expect(isOutboxOperationStatus(0)).toBe(false);
    expect(isOutboxOperationStatus({ status: "pending" })).toBe(false);
  });

  it("identifies terminal local entity statuses", () => {
    expect(isTerminalLocalSyncStatus("local")).toBe(false);
    expect(isTerminalLocalSyncStatus("pending")).toBe(false);
    expect(isTerminalLocalSyncStatus("syncing")).toBe(false);
    expect(isTerminalLocalSyncStatus("synced")).toBe(true);
    expect(isTerminalLocalSyncStatus("failed")).toBe(true);
  });

  it("identifies terminal outbox operation statuses", () => {
    expect(isTerminalOutboxOperationStatus("pending")).toBe(false);
    expect(isTerminalOutboxOperationStatus("syncing")).toBe(false);
    expect(isTerminalOutboxOperationStatus("synced")).toBe(true);
    expect(isTerminalOutboxOperationStatus("failed")).toBe(true);
    expect(isTerminalOutboxOperationStatus("discarded")).toBe(true);
  });

  it("identifies retryable outbox operation statuses", () => {
    expect(isRetryableOutboxOperationStatus("pending")).toBe(true);
    expect(isRetryableOutboxOperationStatus("failed")).toBe(true);
    expect(isRetryableOutboxOperationStatus("syncing")).toBe(false);
    expect(isRetryableOutboxOperationStatus("synced")).toBe(false);
    expect(isRetryableOutboxOperationStatus("discarded")).toBe(false);
  });
});
