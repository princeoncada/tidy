export const FLUSH_QUIET_WINDOW_MS = 800;
export const FLUSH_BATCH_SIZE_THRESHOLD = 25;

type TimeoutHandle = ReturnType<typeof setTimeout>;

export type FlushScheduler = {
  schedule(): void;
  flushNow(): void;
  cancel(): void;
};

export type CreateFlushSchedulerArgs = {
  flush: () => Promise<void>;
  quietWindowMs?: number;
  batchSizeThreshold?: number;
  setTimeoutImpl?: (handler: () => void, timeoutMs: number) => TimeoutHandle;
  clearTimeoutImpl?: (handle: TimeoutHandle) => void;
  onError?: (error: unknown) => void;
};

export function createFlushScheduler({
  flush,
  quietWindowMs = FLUSH_QUIET_WINDOW_MS,
  batchSizeThreshold = FLUSH_BATCH_SIZE_THRESHOLD,
  setTimeoutImpl = (handler, timeoutMs) => setTimeout(handler, timeoutMs),
  clearTimeoutImpl = (handle) => clearTimeout(handle),
  onError,
}: CreateFlushSchedulerArgs): FlushScheduler {
  let timer: TimeoutHandle | null = null;
  let pendingSignals = 0;
  let running = false;
  let rerunRequested = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  };

  const startQuietWindow = () => {
    clearTimer();
    timer = setTimeoutImpl(() => {
      timer = null;
      runFlush();
    }, quietWindowMs);
  };

  const runFlush = () => {
    if (running) {
      rerunRequested = true;
      return;
    }
    clearTimer();
    running = true;
    pendingSignals = 0;
    void Promise.resolve()
      .then(flush)
      .catch((error) => {
        if (onError) {
          onError(error);
        } else {
          console.error("Flush scheduler flush failed", error);
        }
      })
      .finally(() => {
        running = false;
        if (rerunRequested || pendingSignals > 0) {
          rerunRequested = false;
          startQuietWindow();
        }
      });
  };

  return {
    schedule() {
      pendingSignals += 1;
      if (pendingSignals >= batchSizeThreshold) {
        runFlush();
        return;
      }
      startQuietWindow();
    },
    flushNow() {
      runFlush();
    },
    cancel() {
      clearTimer();
    },
  };
}
