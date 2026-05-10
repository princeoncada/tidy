import { createLocalTimestamp, getLocalDbOrThrow } from "./local-repositories";
import {
  isLocalOutboxOperation,
  type LocalOutboxOperation,
} from "./outbox-schema";
import type { TidyLocalDatabase } from "./tidy-db";

export type LocalOutboxRepositoryDatabase = {
  outboxOperations: {
    put(operation: LocalOutboxOperation): Promise<string>;
    get(operationId: string): Promise<LocalOutboxOperation | undefined>;
    where(indexName: string): {
      equals(value: unknown): {
        sortBy(fieldName: string): Promise<LocalOutboxOperation[]>;
      };
    };
  };
};

type TimestampedUpdateArgs = {
  operationId: string;
  updatedAt?: string;
  db?: LocalOutboxRepositoryDatabase;
};

type FailedUpdateArgs = TimestampedUpdateArgs & {
  errorMessage: string;
};

type PendingQueryArgs = {
  userId: string;
  limit?: number;
  db?: LocalOutboxRepositoryDatabase;
};

function getOutboxRepositoryDb(db?: LocalOutboxRepositoryDatabase): LocalOutboxRepositoryDatabase {
  return db ?? (getLocalDbOrThrow() as TidyLocalDatabase);
}

async function updateOutboxOperation(
  args: TimestampedUpdateArgs & {
    update: (operation: LocalOutboxOperation, updatedAt: string) => LocalOutboxOperation;
  },
): Promise<LocalOutboxOperation | null> {
  const db = getOutboxRepositoryDb(args.db);
  const operation = await db.outboxOperations.get(args.operationId);

  if (!operation) {
    return null;
  }

  const updatedOperation = args.update(operation, args.updatedAt ?? createLocalTimestamp());
  await db.outboxOperations.put(updatedOperation);
  return updatedOperation;
}

export async function enqueueOutboxOperation(
  operation: LocalOutboxOperation,
  db?: LocalOutboxRepositoryDatabase,
): Promise<string> {
  if (!isLocalOutboxOperation(operation)) {
    throw new Error("Invalid local outbox operation.");
  }

  return getOutboxRepositoryDb(db).outboxOperations.put(operation);
}

export async function getOutboxOperationById(
  operationId: string,
  db?: LocalOutboxRepositoryDatabase,
): Promise<LocalOutboxOperation | null> {
  const operation = await getOutboxRepositoryDb(db).outboxOperations.get(operationId);
  return operation ?? null;
}

export async function getPendingOutboxOperations({
  userId,
  limit,
  db,
}: PendingQueryArgs): Promise<LocalOutboxOperation[]> {
  const operations = await getOutboxRepositoryDb(db)
    .outboxOperations.where("[userId+status]")
    .equals([userId, "pending"])
    .sortBy("createdAt");

  return typeof limit === "number" ? operations.slice(0, limit) : operations;
}

export async function markOutboxOperationSyncing(
  args: TimestampedUpdateArgs,
): Promise<LocalOutboxOperation | null> {
  return updateOutboxOperation({
    ...args,
    update: (operation, updatedAt) => ({
      ...operation,
      status: "syncing",
      updatedAt,
      lastAttemptedAt: updatedAt,
      errorMessage: null,
    }),
  });
}

export async function markOutboxOperationSynced(
  args: TimestampedUpdateArgs,
): Promise<LocalOutboxOperation | null> {
  return updateOutboxOperation({
    ...args,
    update: (operation, updatedAt) => ({
      ...operation,
      status: "synced",
      updatedAt,
      errorMessage: null,
    }),
  });
}

export async function markOutboxOperationFailed({
  errorMessage,
  ...args
}: FailedUpdateArgs): Promise<LocalOutboxOperation | null> {
  return updateOutboxOperation({
    ...args,
    update: (operation, updatedAt) => ({
      ...operation,
      status: "failed",
      updatedAt,
      errorMessage,
    }),
  });
}

export async function markOutboxOperationDiscarded(
  args: TimestampedUpdateArgs,
): Promise<LocalOutboxOperation | null> {
  return updateOutboxOperation({
    ...args,
    update: (operation, updatedAt) => ({
      ...operation,
      status: "discarded",
      updatedAt,
    }),
  });
}

export async function incrementRetryCount(
  args: TimestampedUpdateArgs,
): Promise<LocalOutboxOperation | null> {
  return updateOutboxOperation({
    ...args,
    update: (operation, updatedAt) => ({
      ...operation,
      retryCount: operation.retryCount + 1,
      updatedAt,
    }),
  });
}
