import { describe, expect, it } from "vitest";

import {
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
  computeRetryDelayMs,
  isOutboxOperationRetryExhausted,
  isOutboxOperationRetryReady,
} from "@/lib/sync/retry-backoff";
import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

function createOperation(
  overrides: Partial<
    Pick<LocalOutboxOperation, "status" | "retryCount" | "lastAttemptedAt">
  > = {},
) {
  return {
    status: "failed" as const,
    retryCount: 1,
    lastAttemptedAt: "2026-06-11T10:00:00.000Z",
    ...overrides,
  };
}

describe("retry backoff", () => {
  it("returns zero for non-positive or non-finite retry counts", () => {
    expect(computeRetryDelayMs(0)).toBe(0);
    expect(computeRetryDelayMs(-1)).toBe(0);
    expect(computeRetryDelayMs(Number.NaN)).toBe(0);
  });

  it("grows exponentially and caps at the maximum delay", () => {
    expect(computeRetryDelayMs(1)).toBe(1_000);
    expect(computeRetryDelayMs(2)).toBe(2_000);
    expect(computeRetryDelayMs(3)).toBe(4_000);
    expect(computeRetryDelayMs(20)).toBe(RETRY_MAX_DELAY_MS);
  });

  it("treats pending operations as immediately retryable", () => {
    expect(
      isOutboxOperationRetryReady({
        operation: createOperation({ status: "pending" }),
        now: Date.parse("2026-06-11T10:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("allows failed operations after the backoff window or without a valid attempt time", () => {
    const now = Date.parse("2026-06-11T10:00:02.000Z");

    expect(
      isOutboxOperationRetryReady({
        operation: createOperation(),
        now,
      }),
    ).toBe(true);
    expect(
      isOutboxOperationRetryReady({
        operation: createOperation({ lastAttemptedAt: null }),
        now,
      }),
    ).toBe(true);
    expect(
      isOutboxOperationRetryReady({
        operation: createOperation({ lastAttemptedAt: "invalid" }),
        now,
      }),
    ).toBe(true);
  });

  it("holds failed operations inside the backoff window", () => {
    expect(
      isOutboxOperationRetryReady({
        operation: createOperation({ retryCount: 2 }),
        now: Date.parse("2026-06-11T10:00:01.999Z"),
      }),
    ).toBe(false);
  });

  it("stops automatic retries at the attempt cap", () => {
    for (const retryCount of [RETRY_MAX_ATTEMPTS, RETRY_MAX_ATTEMPTS + 1]) {
      expect(
        isOutboxOperationRetryReady({
          operation: createOperation({ retryCount }),
          now: Date.parse("2026-06-11T11:00:00.000Z"),
        }),
      ).toBe(false);
    }
  });

  it("does not retry non-pending, non-failed statuses", () => {
    for (const status of ["syncing", "synced", "discarded"] as const) {
      expect(
        isOutboxOperationRetryReady({
          operation: createOperation({ status }),
          now: Date.parse("2026-06-11T11:00:00.000Z"),
        }),
      ).toBe(false);
    }
  });

  it("reports exhaustion only for failed operations at or above the cap", () => {
    expect(
      isOutboxOperationRetryExhausted(
        createOperation({ retryCount: RETRY_MAX_ATTEMPTS }),
      ),
    ).toBe(true);
    expect(
      isOutboxOperationRetryExhausted(
        createOperation({ retryCount: RETRY_MAX_ATTEMPTS - 1 }),
      ),
    ).toBe(false);
    expect(
      isOutboxOperationRetryExhausted(
        createOperation({
          status: "pending",
          retryCount: RETRY_MAX_ATTEMPTS,
        }),
      ),
    ).toBe(false);
  });
});
