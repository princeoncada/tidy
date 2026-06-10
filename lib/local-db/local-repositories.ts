import { tidyLocalDb, type TidyLocalDatabase } from "./tidy-db";
import type { LocalGraphReconcilePlan } from "../local-first-reconcile";
import type {
  LocalEntityBase,
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "./local-schema";
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

export async function listLocalListsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalList[]> {
  const rows = await db.lists.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalViewsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalView[]> {
  const rows = await db.views.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalListItemsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalListItem[]> {
  const rows = await db.listItems.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalTagsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalTag[]> {
  const rows = await db.tags.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalListTagsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalListTag[]> {
  const rows = await db.listTags.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalViewListsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalViewList[]> {
  const rows = await db.viewLists.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function listLocalViewTagsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalViewTag[]> {
  const rows = await db.viewTags.where("userId").equals(userId).toArray();
  return rows.filter((row) => row.deletedAt === null);
}

export async function putLocalViews(
  views: LocalView[],
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<void> {
  await db.views.bulkPut(views);
}

export async function putLocalLists(
  lists: LocalList[],
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<void> {
  await db.lists.bulkPut(lists);
}

export async function applyLocalGraphReconcilePlan(
  plan: LocalGraphReconcilePlan,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.views,
      db.lists,
      db.listItems,
      db.tags,
      db.listTags,
      db.viewLists,
      db.viewTags,
    ],
    async () => {
      if (plan.views.upserts.length > 0) {
        await db.views.bulkPut(plan.views.upserts);
      }
      if (plan.views.deleteClientIds.length > 0) {
        await db.views.bulkDelete(plan.views.deleteClientIds);
      }
      if (plan.lists.upserts.length > 0) {
        await db.lists.bulkPut(plan.lists.upserts);
      }
      if (plan.lists.deleteClientIds.length > 0) {
        await db.lists.bulkDelete(plan.lists.deleteClientIds);
      }
      if (plan.listItems.upserts.length > 0) {
        await db.listItems.bulkPut(plan.listItems.upserts);
      }
      if (plan.listItems.deleteClientIds.length > 0) {
        await db.listItems.bulkDelete(plan.listItems.deleteClientIds);
      }
      if (plan.tags.upserts.length > 0) {
        await db.tags.bulkPut(plan.tags.upserts);
      }
      if (plan.tags.deleteClientIds.length > 0) {
        await db.tags.bulkDelete(plan.tags.deleteClientIds);
      }
      if (plan.listTags.upserts.length > 0) {
        await db.listTags.bulkPut(plan.listTags.upserts);
      }
      if (plan.listTags.deleteClientIds.length > 0) {
        await db.listTags.bulkDelete(plan.listTags.deleteClientIds);
      }
      if (plan.viewLists.upserts.length > 0) {
        await db.viewLists.bulkPut(plan.viewLists.upserts);
      }
      if (plan.viewLists.deleteClientIds.length > 0) {
        await db.viewLists.bulkDelete(plan.viewLists.deleteClientIds);
      }
      if (plan.viewTags.upserts.length > 0) {
        await db.viewTags.bulkPut(plan.viewTags.upserts);
      }
      if (plan.viewTags.deleteClientIds.length > 0) {
        await db.viewTags.bulkDelete(plan.viewTags.deleteClientIds);
      }
    },
  );
}
