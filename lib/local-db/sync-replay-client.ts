import { coalesceOutboxOperations } from "./outbox-coalescing";
import {
  getPendingOutboxOperations,
  getRetryableOutboxOperations,
  incrementRetryCount,
  markOutboxOperationDiscarded,
  markOutboxOperationFailed,
  markOutboxOperationSynced,
  markOutboxOperationSyncing,
  type LocalOutboxRepositoryDatabase,
} from "./outbox-repository";
import type { LocalOutboxOperation } from "./outbox-schema";
import {
  resolveOutboxOperationConflict,
  type SyncServerEntitySnapshot,
} from "@/lib/sync/conflict-resolution";
import {
  SYNC_BATCH_MAX_OPERATIONS,
  SYNC_BATCH_MAX_TOTAL_BYTES,
  type SyncBatchRequest,
} from "@/lib/sync/sync-batch-contract";

export type SyncReplayTransportRequest = {
  operation: LocalOutboxOperation;
  idempotencyKey: string;
};

export type SyncReplayTransport = (request: SyncReplayTransportRequest) => Promise<void>;

export type SyncBatchOperationResult = {
  operationId: string;
  status: "applied" | "already-applied" | "rejected" | "failed";
  errorMessage: string | null;
};

export type SyncBatchTransport = (
  request: SyncBatchRequest,
) => Promise<SyncBatchOperationResult[]>;

export type SyncReplayOperationResult = {
  operationId: string;
  status: "synced" | "failed" | "discarded" | "missing" | "resolved-server-wins";
  errorMessage: string | null;
};

export type SyncReplayResult = {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
  discardedCount: number;
  missingCount: number;
  serverWonCount: number;
  results: SyncReplayOperationResult[];
};

export type SyncReplayRepository = {
  getPendingOutboxOperations(args: { userId: string; limit?: number }): Promise<LocalOutboxOperation[]>;
  getRetryableOutboxOperations(args: {
    userId: string;
    now: number;
    limit?: number;
  }): Promise<LocalOutboxOperation[]>;
  markOutboxOperationDiscarded(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationSyncing(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationSynced(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationFailed(args: {
    operationId: string;
    errorMessage: string;
  }): Promise<LocalOutboxOperation | null>;
  incrementRetryCount(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
};

export type SyncServerSnapshotProvider = (
  operation: LocalOutboxOperation,
) => Promise<SyncServerEntitySnapshot | null>;

export type ReplayOutboxOperationsArgs = {
  userId: string;
  transport: SyncReplayTransport;
  limit?: number;
  db?: LocalOutboxRepositoryDatabase;
  repository?: SyncReplayRepository;
  getServerSnapshot?: SyncServerSnapshotProvider;
};

export type FlushOutboxOperationsBatchArgs = {
  userId: string;
  transport: SyncBatchTransport;
  limit?: number;
  now?: number;
  db?: LocalOutboxRepositoryDatabase;
  repository?: SyncReplayRepository;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Outbox replay failed.";
}

function createDefaultSyncReplayRepository(
  db?: LocalOutboxRepositoryDatabase,
): SyncReplayRepository {
  return {
    getPendingOutboxOperations: (args) => getPendingOutboxOperations({ ...args, db }),
    getRetryableOutboxOperations: (args) => getRetryableOutboxOperations({ ...args, db }),
    markOutboxOperationDiscarded: (args) => markOutboxOperationDiscarded({ ...args, db }),
    markOutboxOperationSyncing: (args) => markOutboxOperationSyncing({ ...args, db }),
    markOutboxOperationSynced: (args) => markOutboxOperationSynced({ ...args, db }),
    markOutboxOperationFailed: (args) => markOutboxOperationFailed({ ...args, db }),
    incrementRetryCount: (args) => incrementRetryCount({ ...args, db }),
  };
}

function summarizeReplayResults(results: SyncReplayOperationResult[]): SyncReplayResult {
  return {
    attemptedCount: results.filter((result) => result.status === "synced" || result.status === "failed").length,
    syncedCount: results.filter((result) => result.status === "synced").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    discardedCount: results.filter((result) => result.status === "discarded").length,
    missingCount: results.filter((result) => result.status === "missing").length,
    serverWonCount: results.filter((result) => result.status === "resolved-server-wins").length,
    results,
  };
}

export async function replayOutboxOperations({
  userId,
  transport,
  limit,
  db,
  repository = createDefaultSyncReplayRepository(db),
  getServerSnapshot,
}: ReplayOutboxOperationsArgs): Promise<SyncReplayResult> {
  const pendingOperations = await repository.getPendingOutboxOperations({ userId, limit });
  const { operations, discardedOperationIds } = coalesceOutboxOperations(pendingOperations);
  const results: SyncReplayOperationResult[] = [];

  for (const operationId of discardedOperationIds) {
    const discardedOperation = await repository.markOutboxOperationDiscarded({ operationId });

    results.push({
      operationId,
      status: discardedOperation ? "discarded" : "missing",
      errorMessage: discardedOperation ? null : "Outbox operation was not found while discarding.",
    });
  }

  for (const operation of operations) {
    if (getServerSnapshot) {
      const serverSnapshot = await getServerSnapshot(operation);
      const resolution = resolveOutboxOperationConflict({ operation, serverSnapshot });

      if (resolution.resolution === "skip") {
        const resolvedOperation = await repository.markOutboxOperationDiscarded({
          operationId: operation.operationId,
        });

        results.push({
          operationId: operation.operationId,
          status: resolvedOperation ? "resolved-server-wins" : "missing",
          errorMessage: resolvedOperation
            ? null
            : "Outbox operation was not found while resolving a server-wins conflict.",
        });
        continue;
      }
    }

    const syncingOperation = await repository.markOutboxOperationSyncing({
      operationId: operation.operationId,
    });

    if (!syncingOperation) {
      results.push({
        operationId: operation.operationId,
        status: "missing",
        errorMessage: "Outbox operation was not found before replay.",
      });
      continue;
    }

    try {
      await transport({
        operation: syncingOperation,
        idempotencyKey: syncingOperation.idempotencyKey,
      });

      const syncedOperation = await repository.markOutboxOperationSynced({
        operationId: syncingOperation.operationId,
      });

      results.push({
        operationId: syncingOperation.operationId,
        status: syncedOperation ? "synced" : "missing",
        errorMessage: syncedOperation ? null : "Outbox operation was not found after replay.",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await repository.incrementRetryCount({ operationId: syncingOperation.operationId });
      await repository.markOutboxOperationFailed({
        operationId: syncingOperation.operationId,
        errorMessage,
      });

      results.push({
        operationId: syncingOperation.operationId,
        status: "failed",
        errorMessage,
      });
    }
  }

  return summarizeReplayResults(results);
}

export async function flushOutboxOperationsBatch({
  userId,
  transport,
  limit,
  now,
  db,
  repository = createDefaultSyncReplayRepository(db),
}: FlushOutboxOperationsBatchArgs): Promise<SyncReplayResult> {
  const boundedLimit = Math.min(
    limit ?? SYNC_BATCH_MAX_OPERATIONS,
    SYNC_BATCH_MAX_OPERATIONS,
  );
  const pendingOperations = await repository.getRetryableOutboxOperations({
    userId,
    now: now ?? Date.now(),
    limit: boundedLimit,
  });
  const { operations: coalescedOperations, discardedOperationIds } =
    coalesceOutboxOperations(pendingOperations);
  const operations: LocalOutboxOperation[] = [];
  let totalPayloadBytes = 0;

  for (const operation of coalescedOperations) {
    if (operations.length >= SYNC_BATCH_MAX_OPERATIONS) {
      break;
    }

    const payloadBytes = new TextEncoder().encode(
      JSON.stringify(operation.payload),
    ).byteLength;

    if (
      operations.length > 0 &&
      totalPayloadBytes + payloadBytes > SYNC_BATCH_MAX_TOTAL_BYTES
    ) {
      break;
    }

    operations.push(operation);
    totalPayloadBytes += payloadBytes;
  }
  const results: SyncReplayOperationResult[] = [];

  for (const operationId of discardedOperationIds) {
    const discardedOperation = await repository.markOutboxOperationDiscarded({
      operationId,
    });

    results.push({
      operationId,
      status: discardedOperation ? "discarded" : "missing",
      errorMessage: discardedOperation
        ? null
        : "Outbox operation was not found while discarding.",
    });
  }

  const syncingOperations: LocalOutboxOperation[] = [];

  for (const operation of operations) {
    const syncingOperation = await repository.markOutboxOperationSyncing({
      operationId: operation.operationId,
    });

    if (!syncingOperation) {
      results.push({
        operationId: operation.operationId,
        status: "missing",
        errorMessage: "Outbox operation was not found before batch replay.",
      });
      continue;
    }

    syncingOperations.push(syncingOperation);
  }

  if (syncingOperations.length === 0) {
    return summarizeReplayResults(results);
  }

  let serverResults: SyncBatchOperationResult[];
  try {
    serverResults = await transport({
      operations: syncingOperations.map((operation) => ({
        operation,
        idempotencyKey: operation.idempotencyKey,
      })),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    for (const operation of syncingOperations) {
      await repository.incrementRetryCount({
        operationId: operation.operationId,
      });
      await repository.markOutboxOperationFailed({
        operationId: operation.operationId,
        errorMessage,
      });
      results.push({
        operationId: operation.operationId,
        status: "failed",
        errorMessage,
      });
    }

    return summarizeReplayResults(results);
  }

  const serverResultByOperationId = new Map(
    serverResults.map((serverResult) => [
      serverResult.operationId,
      serverResult,
    ]),
  );

  for (const operation of syncingOperations) {
    const serverResult = serverResultByOperationId.get(operation.operationId);

    if (
      serverResult?.status === "applied" ||
      serverResult?.status === "already-applied"
    ) {
      const syncedOperation = await repository.markOutboxOperationSynced({
        operationId: operation.operationId,
      });
      results.push({
        operationId: operation.operationId,
        status: syncedOperation ? "synced" : "missing",
        errorMessage: syncedOperation
          ? null
          : "Outbox operation was not found after batch replay.",
      });
      continue;
    }

    const isTransientFailure =
      !serverResult || serverResult.status === "failed";
    const errorMessage =
      serverResult?.errorMessage ??
      (serverResult
        ? "Sync operation was rejected without an error message."
        : "Sync endpoint did not return a result for this operation.");

    if (isTransientFailure) {
      await repository.incrementRetryCount({
        operationId: operation.operationId,
      });
    }
    await repository.markOutboxOperationFailed({
      operationId: operation.operationId,
      errorMessage,
    });
    results.push({
      operationId: operation.operationId,
      status: "failed",
      errorMessage,
    });
  }

  return summarizeReplayResults(results);
}
