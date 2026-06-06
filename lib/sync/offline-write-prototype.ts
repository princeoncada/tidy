import {
  enqueueOutboxOperation,
  getOutboxOperationsForUser,
  getPendingOutboxOperations,
  type LocalOutboxRepositoryDatabase,
} from "@/lib/local-db/outbox-repository";
import {
  replayOutboxOperations,
  type SyncReplayRepository,
  type SyncReplayResult,
  type SyncReplayTransport,
} from "@/lib/local-db/sync-replay-client";
import { createOutboxOperation } from "@/lib/local-db/local-repositories";
import {
  createSyncStatusSurface,
  type SyncStatusSurface,
} from "@/lib/sync/sync-status-surface";
import type {
  LocalJsonValue,
  LocalOutboxEntityType,
  LocalOutboxOperation,
  LocalOutboxOperationType,
} from "@/lib/local-db/outbox-schema";

export function isOfflineWriteCaptureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OFFLINE_WRITE_PROTOTYPE_ENABLED === "true";
}

export type OfflineWriteIntent = {
  userId: string;
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  entityServerId?: string | null;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
  idempotencyKey?: string;
};

export async function captureOfflineWrite(
  intent: OfflineWriteIntent,
  options: { db?: LocalOutboxRepositoryDatabase } = {},
): Promise<LocalOutboxOperation> {
  const operation = createOutboxOperation(intent);
  await enqueueOutboxOperation(operation, options.db);
  return operation;
}

export async function captureDashboardMutationOutbox(
  intent: OfflineWriteIntent,
  options: { db?: LocalOutboxRepositoryDatabase } = {},
): Promise<LocalOutboxOperation | null> {
  if (!isOfflineWriteCaptureEnabled()) {
    return null;
  }

  try {
    return await captureOfflineWrite(intent, options);
  } catch (error) {
    console.error("Failed to capture dashboard mutation outbox operation", error);
    return null;
  }
}

export type CreateHttpSyncReplayTransportArgs = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

function getDefaultFetch(): typeof fetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch API is not available for offline write replay.");
  }

  return globalThis.fetch.bind(globalThis) as typeof fetch;
}

export function createHttpSyncReplayTransport(
  args: CreateHttpSyncReplayTransportArgs = {},
): SyncReplayTransport {
  const endpoint = args.endpoint ?? "/api/sync";
  const fetchImpl = args.fetchImpl ?? getDefaultFetch();

  return async ({ operation, idempotencyKey }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ operation, idempotencyKey }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Sync replay HTTP ${response.status}: ${responseText}`);
    }
  };
}

export type FlushOfflineWritesArgs = {
  userId: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  limit?: number;
  db?: LocalOutboxRepositoryDatabase;
  repository?: SyncReplayRepository;
};

export async function flushOfflineWrites(args: FlushOfflineWritesArgs): Promise<SyncReplayResult> {
  const transportArgs: CreateHttpSyncReplayTransportArgs = {};

  if (args.endpoint !== undefined) {
    transportArgs.endpoint = args.endpoint;
  }

  if (args.fetchImpl !== undefined) {
    transportArgs.fetchImpl = args.fetchImpl;
  }

  const transport = createHttpSyncReplayTransport(transportArgs);
  const replayArgs = {
    userId: args.userId,
    transport,
  };

  if (args.limit !== undefined) {
    Object.assign(replayArgs, { limit: args.limit });
  }

  if (args.db !== undefined) {
    Object.assign(replayArgs, { db: args.db });
  }

  if (args.repository !== undefined) {
    Object.assign(replayArgs, { repository: args.repository });
  }

  return replayOutboxOperations(replayArgs);
}

export type ReconcilePendingWritesArgs = {
  userId: string;
  limit?: number;
  db?: LocalOutboxRepositoryDatabase;
};

export async function reconcilePendingWritesOnLoad(
  args: ReconcilePendingWritesArgs,
): Promise<LocalOutboxOperation[]> {
  if (!isOfflineWriteCaptureEnabled()) {
    return [];
  }

  try {
    const queryArgs: {
      userId: string;
      limit?: number;
      db?: LocalOutboxRepositoryDatabase;
    } = { userId: args.userId };
    if (args.limit !== undefined) queryArgs.limit = args.limit;
    if (args.db !== undefined) queryArgs.db = args.db;
    return await getPendingOutboxOperations(queryArgs);
  } catch (error) {
    console.error("Failed to reconcile pending outbox writes on load", error);
    return [];
  }
}

export type ReadSyncStatusSurfaceArgs = {
  userId: string;
  db?: LocalOutboxRepositoryDatabase;
};

export async function readSyncStatusSurfaceForUser(
  args: ReadSyncStatusSurfaceArgs,
): Promise<SyncStatusSurface> {
  if (!isOfflineWriteCaptureEnabled()) {
    return createSyncStatusSurface([]);
  }

  try {
    const queryArgs: { userId: string; db?: LocalOutboxRepositoryDatabase } = {
      userId: args.userId,
    };
    if (args.db !== undefined) queryArgs.db = args.db;
    const operations = await getOutboxOperationsForUser(queryArgs);
    return createSyncStatusSurface(operations);
  } catch (error) {
    console.error("Failed to read sync status surface", error);
    return createSyncStatusSurface([]);
  }
}
