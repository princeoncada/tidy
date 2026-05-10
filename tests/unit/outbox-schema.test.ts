import { describe, expect, it } from "vitest";

import {
  isLocalJsonValue,
  isLocalOutboxEntityType,
  isLocalOutboxOperation,
  isLocalOutboxOperationType,
  LOCAL_OUTBOX_ENTITY_TYPES,
  LOCAL_OUTBOX_OPERATION_TYPES,
  type LocalOutboxOperation,
} from "@/lib/local-db/outbox-schema";

const validOperation = (overrides: Partial<LocalOutboxOperation> = {}): LocalOutboxOperation => ({
  operationId: "op-1",
  userId: "user-1",
  entityType: "list",
  entityClientId: "local-list-1",
  entityServerId: null,
  operationType: "update",
  payload: { name: "Inbox", order: 1, tags: ["tag-1"], metadata: null },
  status: "pending",
  retryCount: 0,
  errorMessage: null,
  createdAt: "2026-05-10T10:00:00.000Z",
  updatedAt: "2026-05-10T10:00:00.000Z",
  lastAttemptedAt: null,
  idempotencyKey: "op-1",
  ...overrides,
});

describe("outbox schema model", () => {
  it("exposes supported entity and operation types", () => {
    expect(LOCAL_OUTBOX_ENTITY_TYPES).toEqual([
      "view",
      "list",
      "listItem",
      "tag",
      "viewTag",
      "listTag",
      "viewList",
      "metadata",
    ]);
    expect(LOCAL_OUTBOX_OPERATION_TYPES).toEqual([
      "create",
      "update",
      "delete",
      "reorder",
      "move",
      "attach",
      "detach",
      "upsert",
    ]);
  });

  it("guards outbox entity and operation types", () => {
    expect(isLocalOutboxEntityType("listItem")).toBe(true);
    expect(isLocalOutboxEntityType("task")).toBe(false);
    expect(isLocalOutboxEntityType(null)).toBe(false);

    expect(isLocalOutboxOperationType("reorder")).toBe(true);
    expect(isLocalOutboxOperationType("rename")).toBe(false);
    expect(isLocalOutboxOperationType(undefined)).toBe(false);
  });

  it("accepts JSON-compatible payload values", () => {
    expect(isLocalJsonValue(null)).toBe(true);
    expect(isLocalJsonValue("name")).toBe(true);
    expect(isLocalJsonValue(1)).toBe(true);
    expect(isLocalJsonValue(false)).toBe(true);
    expect(isLocalJsonValue(["a", 1, null])).toBe(true);
    expect(isLocalJsonValue({ name: "Inbox", nested: { order: 1 } })).toBe(true);
  });

  it("rejects non-JSON-compatible payload values", () => {
    expect(isLocalJsonValue(undefined)).toBe(false);
    expect(isLocalJsonValue(Number.NaN)).toBe(false);
    expect(isLocalJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isLocalJsonValue(() => "nope")).toBe(false);
    expect(isLocalJsonValue(new Date("2026-05-10T10:00:00.000Z"))).toBe(false);
    expect(isLocalJsonValue({ invalid: undefined })).toBe(false);
  });

  it("accepts a complete valid outbox operation", () => {
    expect(isLocalOutboxOperation(validOperation())).toBe(true);
  });

  it("accepts nullable server and error metadata", () => {
    expect(
      isLocalOutboxOperation(
        validOperation({
          entityServerId: "server-list-1",
          errorMessage: "Network unavailable",
          lastAttemptedAt: "2026-05-10T10:01:00.000Z",
          status: "failed",
          retryCount: 1,
        }),
      ),
    ).toBe(true);
  });

  it("rejects operations with invalid model metadata", () => {
    expect(isLocalOutboxOperation(validOperation({ operationId: "" }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ entityType: "task" as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ operationType: "rename" as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ status: "queued" as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ retryCount: -1 }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ idempotencyKey: "" }))).toBe(false);
  });

  it("rejects operations with invalid nullable metadata or payload", () => {
    expect(isLocalOutboxOperation(validOperation({ entityServerId: undefined as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ errorMessage: undefined as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ lastAttemptedAt: undefined as never }))).toBe(false);
    expect(isLocalOutboxOperation(validOperation({ payload: { name: undefined } as never }))).toBe(false);
  });
});
