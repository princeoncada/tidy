import { isOutboxOperationStatus } from "./sync-status";

export type LocalJsonValue =
  | string
  | number
  | boolean
  | null
  | LocalJsonValue[]
  | { [key: string]: LocalJsonValue };

export type LocalOutboxOperationStatus = "pending" | "syncing" | "synced" | "failed" | "discarded";

export type LocalOutboxEntityType =
  | "view"
  | "list"
  | "listItem"
  | "tag"
  | "viewTag"
  | "listTag"
  | "viewList"
  | "metadata";

export type LocalOutboxOperationType =
  | "create"
  | "update"
  | "delete"
  | "reorder"
  | "move"
  | "attach"
  | "detach"
  | "upsert";

export type LocalOutboxOperation = {
  operationId: string;
  userId: string;
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  entityServerId: string | null;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
  status: LocalOutboxOperationStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptedAt: string | null;
  idempotencyKey: string;
};

export const LOCAL_OUTBOX_ENTITY_TYPES = [
  "view",
  "list",
  "listItem",
  "tag",
  "viewTag",
  "listTag",
  "viewList",
  "metadata",
] as const satisfies readonly LocalOutboxEntityType[];

export const LOCAL_OUTBOX_OPERATION_TYPES = [
  "create",
  "update",
  "delete",
  "reorder",
  "move",
  "attach",
  "detach",
  "upsert",
] as const satisfies readonly LocalOutboxOperationType[];

function includesOutboxValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPlainJsonObject(value: object): value is { [key: string]: LocalJsonValue } {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isLocalOutboxEntityType(value: unknown): value is LocalOutboxEntityType {
  return includesOutboxValue(LOCAL_OUTBOX_ENTITY_TYPES, value);
}

export function isLocalOutboxOperationType(value: unknown): value is LocalOutboxOperationType {
  return includesOutboxValue(LOCAL_OUTBOX_OPERATION_TYPES, value);
}

export function isLocalJsonValue(value: unknown): value is LocalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isLocalJsonValue);
  }

  if (typeof value === "object" && value !== null && isPlainJsonObject(value)) {
    return Object.values(value).every(isLocalJsonValue);
  }

  return false;
}

export function isLocalOutboxOperation(value: unknown): value is LocalOutboxOperation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const operation = value as Record<string, unknown>;

  return (
    typeof operation.operationId === "string" &&
    operation.operationId.length > 0 &&
    typeof operation.userId === "string" &&
    operation.userId.length > 0 &&
    isLocalOutboxEntityType(operation.entityType) &&
    typeof operation.entityClientId === "string" &&
    operation.entityClientId.length > 0 &&
    isNullableString(operation.entityServerId) &&
    isLocalOutboxOperationType(operation.operationType) &&
    isLocalJsonValue(operation.payload) &&
    isOutboxOperationStatus(operation.status) &&
    isNonNegativeInteger(operation.retryCount) &&
    isNullableString(operation.errorMessage) &&
    typeof operation.createdAt === "string" &&
    operation.createdAt.length > 0 &&
    typeof operation.updatedAt === "string" &&
    operation.updatedAt.length > 0 &&
    isNullableString(operation.lastAttemptedAt) &&
    typeof operation.idempotencyKey === "string" &&
    operation.idempotencyKey.length > 0
  );
}
