import { tidyLocalDb, type TidyLocalDatabase } from "./tidy-db";
import type { LocalEntityBase, LocalList, LocalListItem, LocalView } from "./local-schema";
import type {
  LocalJsonValue,
  LocalOutboxEntityType,
  LocalOutboxOperation,
  LocalOutboxOperationStatus,
  LocalOutboxOperationType,
} from "./outbox-schema";

type CreateLocalEntityBaseArgs = {
  clientId: string;
  userId: string;
  serverId?: string | null;
  syncStatus?: LocalEntityBase["syncStatus"];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastSyncedAt?: string | null;
};

type CreateOutboxOperationArgs = {
  operationId?: string;
  userId: string;
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  entityServerId?: string | null;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
  status?: LocalOutboxOperationStatus;
  retryCount?: number;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastAttemptedAt?: string | null;
  idempotencyKey?: string;
};

export function createLocalTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function createLocalEntityBase(args: CreateLocalEntityBaseArgs): LocalEntityBase {
  const createdAt = args.createdAt ?? createLocalTimestamp();

  return {
    clientId: args.clientId,
    serverId: args.serverId ?? null,
    userId: args.userId,
    syncStatus: args.syncStatus ?? "local",
    createdAt,
    updatedAt: args.updatedAt ?? createdAt,
    deletedAt: args.deletedAt ?? null,
    lastSyncedAt: args.lastSyncedAt ?? null,
  };
}

export function markEntityPending<T extends LocalEntityBase>(
  entity: T,
  updatedAt = createLocalTimestamp(),
): T {
  return {
    ...entity,
    syncStatus: "pending",
    updatedAt,
  };
}

export function markEntitySynced<T extends LocalEntityBase>(
  entity: T,
  serverId: string,
  syncedAt = createLocalTimestamp(),
): T {
  return {
    ...entity,
    serverId,
    syncStatus: "synced",
    updatedAt: syncedAt,
    lastSyncedAt: syncedAt,
  };
}

export function markEntityFailed<T extends LocalEntityBase>(
  entity: T,
  updatedAt = createLocalTimestamp(),
): T {
  return {
    ...entity,
    syncStatus: "failed",
    updatedAt,
  };
}

export function createOutboxOperation(args: CreateOutboxOperationArgs): LocalOutboxOperation {
  const operationId = args.operationId ?? globalThis.crypto.randomUUID();
  const createdAt = args.createdAt ?? createLocalTimestamp();

  return {
    operationId,
    userId: args.userId,
    entityType: args.entityType,
    entityClientId: args.entityClientId,
    entityServerId: args.entityServerId ?? null,
    operationType: args.operationType,
    payload: args.payload,
    status: args.status ?? "pending",
    retryCount: args.retryCount ?? 0,
    errorMessage: args.errorMessage ?? null,
    createdAt,
    updatedAt: args.updatedAt ?? createdAt,
    lastAttemptedAt: args.lastAttemptedAt ?? null,
    idempotencyKey: args.idempotencyKey ?? operationId,
  };
}

export function getLocalDbOrThrow(): TidyLocalDatabase {
  if (!tidyLocalDb) {
    throw new Error("Tidy local database is only available in the browser.");
  }

  return tidyLocalDb;
}

export async function putLocalView(
  view: LocalView,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<string> {
  return db.views.put(view);
}

export async function putLocalList(
  list: LocalList,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<string> {
  return db.lists.put(list);
}

export async function putLocalListItem(
  item: LocalListItem,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<string> {
  return db.listItems.put(item);
}

export async function putOutboxOperation(
  operation: LocalOutboxOperation,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<string> {
  return db.outboxOperations.put(operation);
}
