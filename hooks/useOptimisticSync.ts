import { useCallback } from "react";
import {
  captureDashboardMutationOutbox,
  type OfflineWriteIntent,
} from "@/lib/sync/offline-write-prototype";
import {
  markOutboxOperationFailed,
  markOutboxOperationSynced,
  type LocalOutboxRepositoryDatabase,
} from "@/lib/local-db/outbox-repository";

export type OptimisticScope =
  | "views"
  | "list-tags"
  | "list-order"
  | "item-order"
  | "view-selection"
  | "list-edits"
  | "item-edits";

type QueueEntry = {
  canceled: boolean;
  sequence: number;
};

export type DurablePendingWrite = {
  intent: OfflineWriteIntent;
  db?: LocalOutboxRepositoryDatabase;
};

export type EnqueueOptions = {
  label?: string;
  rollback?: () => void;
  durable?: DurablePendingWrite;
};

type OptimisticTask = () => Promise<void>;

type OptimisticSyncApi = {
  enqueue: (
    scope: OptimisticScope,
    task: OptimisticTask,
    options?: EnqueueOptions
  ) => Promise<void>;
  cancelScope: (scope: OptimisticScope) => void;
  replacePending: (
    scope: OptimisticScope,
    task: OptimisticTask,
    options?: EnqueueOptions
  ) => Promise<void>;
};

const chains: Record<OptimisticScope, Promise<void>> = {
  views: Promise.resolve(),
  "list-tags": Promise.resolve(),
  "list-order": Promise.resolve(),
  "item-order": Promise.resolve(),
  "view-selection": Promise.resolve(),
  "list-edits": Promise.resolve(),
  "item-edits": Promise.resolve(),
};

const entries: Record<OptimisticScope, QueueEntry[]> = {
  views: [],
  "list-tags": [],
  "list-order": [],
  "item-order": [],
  "view-selection": [],
  "list-edits": [],
  "item-edits": [],
};

const latestStartedSequence: Record<OptimisticScope, number> = {
  views: 0,
  "list-tags": 0,
  "list-order": 0,
  "item-order": 0,
  "view-selection": 0,
  "list-edits": 0,
  "item-edits": 0,
};

let nextSequence = 0;

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause,
    };
  }

  return error;
}

function isCancelledError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "message" in error &&
    error.message === "CancelledError"
  );
}

function canRunRollback(scope: OptimisticScope, entry: QueueEntry) {
  return !entry.canceled && latestStartedSequence[scope] <= entry.sequence;
}

function startDurablePendingWrite(
  durable: DurablePendingWrite,
): Promise<string | null> {
  const options = durable.db ? { db: durable.db } : {};
  return captureDashboardMutationOutbox(durable.intent, options)
    .then((operation) => operation?.operationId ?? null)
    .catch(() => null);
}

function settleDurablePendingWrite(
  operationIdPromise: Promise<string | null>,
  durable: DurablePendingWrite,
  outcome: "synced" | "failed",
  error?: unknown,
): void {
  void operationIdPromise
    .then((operationId) => {
      if (!operationId) return;
      const dbArg = durable.db ? { db: durable.db } : {};
      if (outcome === "synced") {
        return markOutboxOperationSynced({ operationId, ...dbArg });
      }
      return markOutboxOperationFailed({
        operationId,
        errorMessage:
          error instanceof Error ? error.message : "Optimistic sync failed",
        ...dbArg,
      });
    })
    .catch(() => {});
}

export function useOptimisticSync(): OptimisticSyncApi {
  const cancelScope = useCallback((scope: OptimisticScope) => {
    entries[scope].forEach((entry) => {
      entry.canceled = true;
    });
    entries[scope] = [];
    chains[scope] = Promise.resolve();
  }, []);

  const enqueue = useCallback((
    scope: OptimisticScope,
    task: () => Promise<void>,
    options: EnqueueOptions = {}
  ) => {
    const entry: QueueEntry = {
      canceled: false,
      sequence: ++nextSequence,
    };
    entries[scope].push(entry);

    // These queues are shared by every component instance. Tag writes from two open pickers must not overlap.
    chains[scope] = chains[scope]
      .then(async () => {
        if (entry.canceled) return;
        latestStartedSequence[scope] = Math.max(
          latestStartedSequence[scope],
          entry.sequence
        );

        const durableOperationIdPromise = options.durable
          ? startDurablePendingWrite(options.durable)
          : null;

        try {
          await task();
          if (durableOperationIdPromise && options.durable) {
            settleDurablePendingWrite(
              durableOperationIdPromise,
              options.durable,
              "synced"
            );
          }
        } catch (error) {
          if (durableOperationIdPromise && options.durable) {
            settleDurablePendingWrite(
              durableOperationIdPromise,
              options.durable,
              "failed",
              error
            );
          }
          throw error;
        }
      })
      .catch((error) => {
        if (isCancelledError(error)) return;

        if (canRunRollback(scope, entry)) {
          options.rollback?.();
        }

        console.error("Optimistic sync failed:", {
          scope,
          label: options.label ?? "unnamed task",
          error: describeError(error),
        });
      })
      .finally(() => {
        entries[scope] = entries[scope].filter(
          (currentEntry) => currentEntry !== entry
        );
      });

    return chains[scope];
  }, []);

  const replacePending = useCallback((
    scope: OptimisticScope,
    task: () => Promise<void>,
    options: EnqueueOptions = {}
  ) => {
    // Reorders only need the newest final order. Older drag saves would waste time.
    cancelScope(scope);
    return enqueue(scope, task, options);
  }, [cancelScope, enqueue]);

  return { enqueue, cancelScope, replacePending };
}
