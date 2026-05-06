import { useCallback } from "react";

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
};

export type EnqueueOptions = {
  label?: string;
  rollback?: () => void;
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
    const entry: QueueEntry = { canceled: false };
    entries[scope].push(entry);

    // These queues are shared by every component instance. Tag writes from two open pickers must not overlap.
    chains[scope] = chains[scope]
      .then(async () => {
        if (entry.canceled) return;
        await task();
      })
      .catch((error) => {
        if (isCancelledError(error)) return;

        options.rollback?.();
        cancelScope(scope);
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
  }, [cancelScope]);

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
