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
