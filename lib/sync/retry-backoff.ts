import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

export const RETRY_BASE_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 60_000;
export const RETRY_MAX_ATTEMPTS = 8;

export function computeRetryDelayMs(retryCount: number): number {
  if (!Number.isFinite(retryCount) || retryCount <= 0) {
    return 0;
  }
  const exponential = RETRY_BASE_DELAY_MS * 2 ** (retryCount - 1);
  return Math.min(exponential, RETRY_MAX_DELAY_MS);
}

export function isOutboxOperationRetryExhausted(
  operation: Pick<LocalOutboxOperation, "status" | "retryCount">,
): boolean {
  return operation.status === "failed" && operation.retryCount >= RETRY_MAX_ATTEMPTS;
}

export function isOutboxOperationRetryReady({
  operation,
  now,
}: {
  operation: Pick<LocalOutboxOperation, "status" | "retryCount" | "lastAttemptedAt">;
  now: number;
}): boolean {
  if (operation.status === "pending") {
    return true;
  }
  if (operation.status !== "failed") {
    return false;
  }
  if (operation.retryCount >= RETRY_MAX_ATTEMPTS) {
    return false;
  }
  if (!operation.lastAttemptedAt) {
    return true;
  }
  const lastAttemptMs = Date.parse(operation.lastAttemptedAt);
  if (Number.isNaN(lastAttemptMs)) {
    return true;
  }
  return now - lastAttemptMs >= computeRetryDelayMs(operation.retryCount);
}
