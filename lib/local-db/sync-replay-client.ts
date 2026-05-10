import { coalesceOutboxOperations } from "./outbox-coalescing";
import {
  getPendingOutboxOperations,
  incrementRetryCount,
  markOutboxOperationDiscarded,
  markOutboxOperationFailed,
  markOutboxOperationSynced,
  markOutboxOperationSyncing,
  type LocalOutboxRepositoryDatabase,
} from "./outbox-repository";
import type { LocalOutboxOperation } from "./outbox-schema";

export type SyncReplayTransportRequest = {
  operation: LocalOutboxOperation;
  idempotencyKey: string;
};

export type SyncReplayTransport = (request: SyncReplayTransportRequest) => Promise<void>;

export type SyncReplayOperationResult = {
  operationId: string;
  status: "synced" | "failed" | "discarded" | "missing";
  errorMessage: string | null;
};

export type SyncReplayResult = {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
  discardedCount: number;
  missingCount: number;
  results: SyncReplayOperationResult[];
};

export type SyncReplayRepository = {
  getPendingOutboxOperations(args: { userId: string; limit?: number }): Promise<LocalOutboxOperation[]>;
  markOutboxOperationDiscarded(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationSyncing(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationSynced(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
  markOutboxOperationFailed(args: {
    operationId: string;
    errorMessage: string;
  }): Promise<LocalOutboxOperation | null>;
  incrementRetryCount(args: { operationId: string }): Promise<LocalOutboxOperation | null>;
};

export type ReplayOutboxOperationsArgs = {
  userId: string;
  transport: SyncReplayTransport;
  limit?: number;
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
    results,
  };
}

export async function replayOutboxOperations({
  userId,
  transport,
  limit,
  db,
  repository = createDefaultSyncReplayRepository(db),
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
