export const SYNC_LATENCY_SPIKE_STORAGE_KEY =
  "tidy:sync-latency-spike";

const DEFAULT_MAX_EVENTS = 1_000;
const MARKER_PREFIX = "tidy-latency-";

export type SyncLatencyStage =
  | "local_mutation"
  | "push_start"
  | "push_complete"
  | "push_failure"
  | "poke_received"
  | "pull_start"
  | "pull_complete"
  | "pull_failure"
  | "peer_render";

type SyncLatencyDetailValue = string | number | boolean;
type SyncLatencyDetails = Readonly<Record<string, SyncLatencyDetailValue>>;

export type SyncLatencyEvent = {
  sessionId: string;
  trialId: string;
  stage: SyncLatencyStage;
  wallClockMs: number;
  monotonicMs: number;
  details?: SyncLatencyDetails;
};

type SyncLatencyRecorderOptions = {
  enabled: boolean;
  maxEvents?: number;
  sessionId?: string;
  wallClockNow?: () => number;
  monotonicNow?: () => number;
};

type SyncLatencyStorage = Pick<Storage, "getItem">;

export type SyncLatencyWindowApi = {
  readonly enabled: true;
  readonly sessionId: string;
  startTrial: (trialId?: string) => { trialId: string; marker: string };
  stopTrial: () => void;
  events: () => ReadonlyArray<SyncLatencyEvent>;
  clear: () => void;
  exportJson: () => string;
};

declare global {
  interface Window {
    __tidySyncLatency?: SyncLatencyWindowApi;
  }
}

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `${prefix}-${randomId}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function markerForTrial(trialId: string) {
  const safeTrialId = trialId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${MARKER_PREFIX}${safeTrialId || "trial"}`;
}

export function isSyncLatencySpikeEnabled({
  nodeEnv = process.env.NODE_ENV,
  storage,
}: {
  nodeEnv?: string;
  storage?: SyncLatencyStorage | null;
} = {}) {
  if (nodeEnv === "production") return false;

  try {
    const resolvedStorage =
      storage === undefined
        ? typeof window === "undefined"
          ? null
          : window.localStorage
        : storage;
    return resolvedStorage?.getItem(SYNC_LATENCY_SPIKE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export class SyncLatencyRecorder {
  readonly enabled: boolean;
  readonly sessionId: string;

  private readonly maxEvents: number;
  private readonly wallClockNow: () => number;
  private readonly monotonicNow: () => number;
  private readonly recordedEvents: SyncLatencyEvent[] = [];
  private activeTrial: string | null = null;

  constructor({
    enabled,
    maxEvents = DEFAULT_MAX_EVENTS,
    sessionId = createId("session"),
    wallClockNow = Date.now,
    monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  }: SyncLatencyRecorderOptions) {
    this.enabled = enabled;
    this.maxEvents = Math.max(1, maxEvents);
    this.sessionId = sessionId;
    this.wallClockNow = wallClockNow;
    this.monotonicNow = monotonicNow;
  }

  get activeTrialId() {
    return this.activeTrial;
  }

  startTrial(trialId = createId("trial")) {
    const normalizedTrialId = trialId.trim() || createId("trial");
    this.activeTrial = normalizedTrialId;
    return {
      trialId: normalizedTrialId,
      marker: markerForTrial(normalizedTrialId),
    };
  }

  stopTrial() {
    this.activeTrial = null;
  }

  record(
    stage: SyncLatencyStage,
    details?: SyncLatencyDetails,
    trialId = this.activeTrial,
  ) {
    if (!this.enabled || trialId === null) return;

    this.recordedEvents.push({
      sessionId: this.sessionId,
      trialId,
      stage,
      wallClockMs: this.wallClockNow(),
      monotonicMs: this.monotonicNow(),
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    });

    if (this.recordedEvents.length > this.maxEvents) {
      this.recordedEvents.splice(
        0,
        this.recordedEvents.length - this.maxEvents,
      );
    }
  }

  events() {
    return this.recordedEvents.map((event) => ({
      ...event,
      ...(event.details ? { details: { ...event.details } } : {}),
    }));
  }

  clear() {
    this.recordedEvents.length = 0;
  }

  exportJson() {
    return JSON.stringify(this.events(), null, 2);
  }
}

const runtimeRecorder = new SyncLatencyRecorder({
  enabled: isSyncLatencySpikeEnabled(),
});

type MeasuredOperationOptions<T> = {
  startStage: SyncLatencyStage;
  completeStage: SyncLatencyStage;
  failureStage: SyncLatencyStage;
  details?: SyncLatencyDetails;
  completionDetails?: (result: T) => SyncLatencyDetails;
  isFailureResult?: (result: T) => boolean;
};

export async function measureSyncLatencyOperation<T>(
  options: MeasuredOperationOptions<T>,
  operation: () => Promise<T>,
  recorder = runtimeRecorder,
) {
  const trialId = recorder.activeTrialId;
  if (!recorder.enabled || trialId === null) return operation();

  recorder.record(options.startStage, options.details, trialId);
  try {
    const result = await operation();
    const resultDetails = options.completionDetails?.(result);
    recorder.record(
      options.isFailureResult?.(result)
        ? options.failureStage
        : options.completeStage,
      resultDetails ?? options.details,
      trialId,
    );
    return result;
  } catch (error) {
    recorder.record(options.failureStage, options.details, trialId);
    throw error;
  }
}

function safeEntityId(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["id", "itemId", "listId", "viewId", "tagId"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}

export function wrapSyncLatencyMutators<T extends object>(
  mutators: T,
  recorder = runtimeRecorder,
): T {
  if (!recorder.enabled) return mutators;

  const wrappers = new Map<PropertyKey, unknown>();
  return new Proxy(mutators, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      if (wrappers.has(property)) return wrappers.get(property);

      const wrapped = (...args: unknown[]) => {
        const entityId = safeEntityId(args[0]);
        recorder.record("local_mutation", {
          mutationName: String(property),
          ...(entityId ? { entityId } : {}),
        });
        return Reflect.apply(value, target, args);
      };
      wrappers.set(property, wrapped);
      return wrapped;
    },
  });
}

export function recordRuntimeSyncLatencyEvent(
  stage: SyncLatencyStage,
  details?: SyncLatencyDetails,
) {
  runtimeRecorder.record(stage, details);
}

export function installSyncLatencySpikeWindowApi() {
  if (!runtimeRecorder.enabled || typeof window === "undefined") {
    return () => {};
  }

  let renderObserver: MutationObserver | null = null;
  let renderedTrialId: string | null = null;

  const stopRenderObserver = () => {
    renderObserver?.disconnect();
    renderObserver = null;
    renderedTrialId = null;
  };

  const observeMarker = (trialId: string, marker: string) => {
    stopRenderObserver();

    const recordIfRendered = () => {
      if (!document.body?.textContent?.includes(marker)) return false;
      if (renderedTrialId !== trialId) {
        runtimeRecorder.record("peer_render", undefined, trialId);
        renderedTrialId = trialId;
      }
      return true;
    };

    if (recordIfRendered()) return;
    renderObserver = new MutationObserver(() => {
      if (recordIfRendered()) renderObserver?.disconnect();
    });
    renderObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  const api: SyncLatencyWindowApi = {
    enabled: true,
    sessionId: runtimeRecorder.sessionId,
    startTrial: (trialId) => {
      const trial = runtimeRecorder.startTrial(trialId);
      observeMarker(trial.trialId, trial.marker);
      return trial;
    },
    stopTrial: () => {
      stopRenderObserver();
      runtimeRecorder.stopTrial();
    },
    events: () => runtimeRecorder.events(),
    clear: () => runtimeRecorder.clear(),
    exportJson: () => runtimeRecorder.exportJson(),
  };

  window.__tidySyncLatency = api;
  return () => {
    stopRenderObserver();
    runtimeRecorder.stopTrial();
    if (window.__tidySyncLatency === api) {
      delete window.__tidySyncLatency;
    }
  };
}
