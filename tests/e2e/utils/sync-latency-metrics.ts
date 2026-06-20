import type { SyncLatencyEvent } from "@/lib/sync/sync-latency-spike";

export const syncLatencyMetricKeys = [
  "localToPush",
  "pushDuration",
  "pushToPoke",
  "pokeToPull",
  "pullDuration",
  "pullToRender",
  "pullCompleteToRender",
  "endToEnd",
] as const;

export type SyncLatencyMetricKey = (typeof syncLatencyMetricKeys)[number];

export const syncLatencyMetricLabels: Record<SyncLatencyMetricKey, string> = {
  localToPush: "Local-to-push",
  pushDuration: "Push duration",
  pushToPoke: "Push-to-poke",
  pokeToPull: "Poke-to-pull",
  pullDuration: "Pull duration",
  pullToRender: "Pull-to-render",
  pullCompleteToRender: "Pull-complete-to-render",
  endToEnd: "End-to-end",
};

export type SyncLatencyTrialMetrics = {
  trialId: string;
  metrics: Partial<Record<SyncLatencyMetricKey, number>>;
};

export type SyncLatencyMetricSummary = {
  p50?: number;
  p95?: number;
  max?: number;
  validN: number;
  failures: number;
};

export type SyncLatencySummary = Record<
  SyncLatencyMetricKey,
  SyncLatencyMetricSummary
>;

function firstStage(
  events: ReadonlyArray<SyncLatencyEvent>,
  stage: SyncLatencyEvent["stage"],
  afterMonotonicMs = Number.NEGATIVE_INFINITY,
) {
  return events
    .filter(
      (event) =>
        event.stage === stage && event.monotonicMs >= afterMonotonicMs,
    )
    .sort((left, right) => left.monotonicMs - right.monotonicMs)[0];
}

function difference(
  end: SyncLatencyEvent | undefined,
  start: SyncLatencyEvent | undefined,
  clock: "wallClockMs" | "monotonicMs",
) {
  if (!end || !start) return undefined;
  const value = end[clock] - start[clock];
  return Number.isFinite(value) ? value : undefined;
}

export function joinTrialEvents(
  ownerEvents: ReadonlyArray<SyncLatencyEvent>,
  peerEvents: ReadonlyArray<SyncLatencyEvent>,
): SyncLatencyTrialMetrics[] {
  const trialIds = new Set([
    ...ownerEvents.map((event) => event.trialId),
    ...peerEvents.map((event) => event.trialId),
  ]);

  return [...trialIds].map((trialId) => {
    const owner = ownerEvents.filter((event) => event.trialId === trialId);
    const peer = peerEvents.filter((event) => event.trialId === trialId);

    const localMutation = firstStage(owner, "local_mutation");
    const pushStart = firstStage(
      owner,
      "push_start",
      localMutation?.monotonicMs,
    );
    const pushComplete = firstStage(
      owner,
      "push_complete",
      pushStart?.monotonicMs,
    );
    const pokeReceived = firstStage(peer, "poke_received");
    const pullStart = firstStage(
      peer,
      "pull_start",
      pokeReceived?.monotonicMs,
    );
    const pullComplete = firstStage(
      peer,
      "pull_complete",
      pullStart?.monotonicMs,
    );
    const peerRender = firstStage(
      peer,
      "peer_render",
      pullStart?.monotonicMs,
    );

    const metrics: SyncLatencyTrialMetrics["metrics"] = {
      localToPush: difference(pushStart, localMutation, "wallClockMs"),
      pushDuration: difference(pushComplete, pushStart, "monotonicMs"),
      pushToPoke: difference(pokeReceived, pushComplete, "wallClockMs"),
      pokeToPull: difference(pullStart, pokeReceived, "monotonicMs"),
      pullDuration: difference(pullComplete, pullStart, "monotonicMs"),
      pullToRender: difference(peerRender, pullStart, "monotonicMs"),
      pullCompleteToRender: difference(
        peerRender,
        pullComplete,
        "monotonicMs",
      ),
      endToEnd: difference(peerRender, localMutation, "wallClockMs"),
    };

    for (const key of syncLatencyMetricKeys) {
      if (metrics[key] === undefined) delete metrics[key];
    }

    return { trialId, metrics };
  });
}

export function percentile(
  values: ReadonlyArray<number>,
  quantile: number,
) {
  if (values.length === 0) return undefined;
  if (!(quantile > 0 && quantile <= 1)) {
    throw new RangeError("quantile must be greater than 0 and at most 1");
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(quantile * sorted.length) - 1];
}

export function summarize(
  trials: ReadonlyArray<SyncLatencyTrialMetrics>,
): SyncLatencySummary {
  return Object.fromEntries(
    syncLatencyMetricKeys.map((key) => {
      const values = trials
        .map((trial) => trial.metrics[key])
        .filter((value): value is number => value !== undefined);

      return [
        key,
        {
          p50: percentile(values, 0.5),
          p95: percentile(values, 0.95),
          max: values.length > 0 ? Math.max(...values) : undefined,
          validN: values.length,
          failures: trials.length - values.length,
        },
      ];
    }),
  ) as SyncLatencySummary;
}

export function summarizeValues(
  values: ReadonlyArray<number>,
  totalSamples: number,
): SyncLatencyMetricSummary {
  if (!Number.isInteger(totalSamples) || totalSamples < values.length) {
    throw new RangeError(
      "totalSamples must be an integer at least as large as values.length",
    );
  }

  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values.length > 0 ? Math.max(...values) : undefined,
    validN: values.length,
    failures: totalSamples - values.length,
  };
}

function formatMetric(value: number | undefined) {
  return value === undefined ? "Pending" : String(Math.round(value));
}

export function renderResultsMarkdown(summary: SyncLatencySummary) {
  const rows = syncLatencyMetricKeys.map((key) => {
    const metric = summary[key];
    return `| ${syncLatencyMetricLabels[key]} | ${formatMetric(metric.p50)} | ${formatMetric(metric.p95)} | ${formatMetric(metric.max)} | ${metric.validN} | ${metric.failures} |`;
  });

  return [
    "| Metric | p50 | p95 | Max | Valid n | Failures |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}

export function renderBurstResultsMarkdown({
  individualEndToEnd,
  finalMarkerRender,
}: {
  individualEndToEnd: SyncLatencyMetricSummary;
  finalMarkerRender: SyncLatencyMetricSummary;
}) {
  const row = (label: string, metric: SyncLatencyMetricSummary) =>
    `| ${label} | ${formatMetric(metric.p50)} | ${formatMetric(metric.p95)} | ${formatMetric(metric.max)} | ${metric.validN} | ${metric.failures} |`;

  return [
    "| Metric | p50 | p95 | Max | Valid n | Failures |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    row("Individual end-to-end", individualEndToEnd),
    row("Final marker render", finalMarkerRender),
  ].join("\n");
}
