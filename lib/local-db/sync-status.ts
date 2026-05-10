import type { LocalSyncStatus } from "./local-schema";
import type { LocalOutboxOperationStatus } from "./outbox-schema";

export const LOCAL_SYNC_STATUSES = ["local", "pending", "syncing", "synced", "failed"] as const satisfies readonly LocalSyncStatus[];

export const OUTBOX_OPERATION_STATUSES = [
  "pending",
  "syncing",
  "synced",
  "failed",
  "discarded",
] as const satisfies readonly LocalOutboxOperationStatus[];

const TERMINAL_LOCAL_SYNC_STATUSES = ["synced", "failed"] as const satisfies readonly LocalSyncStatus[];

const TERMINAL_OUTBOX_OPERATION_STATUSES = [
  "synced",
  "failed",
  "discarded",
] as const satisfies readonly LocalOutboxOperationStatus[];

const RETRYABLE_OUTBOX_OPERATION_STATUSES = ["pending", "failed"] as const satisfies readonly LocalOutboxOperationStatus[];

function includesStatus<T extends string>(statuses: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (statuses as readonly string[]).includes(value);
}

export function isLocalSyncStatus(value: unknown): value is LocalSyncStatus {
  return includesStatus(LOCAL_SYNC_STATUSES, value);
}

export function isOutboxOperationStatus(value: unknown): value is LocalOutboxOperationStatus {
  return includesStatus(OUTBOX_OPERATION_STATUSES, value);
}

export function isTerminalLocalSyncStatus(status: LocalSyncStatus): boolean {
  return includesStatus(TERMINAL_LOCAL_SYNC_STATUSES, status);
}

export function isTerminalOutboxOperationStatus(status: LocalOutboxOperationStatus): boolean {
  return includesStatus(TERMINAL_OUTBOX_OPERATION_STATUSES, status);
}

export function isRetryableOutboxOperationStatus(status: LocalOutboxOperationStatus): boolean {
  return includesStatus(RETRYABLE_OUTBOX_OPERATION_STATUSES, status);
}
