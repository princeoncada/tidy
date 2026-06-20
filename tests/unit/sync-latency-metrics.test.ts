import { describe, expect, it } from "vitest";

import type {
  SyncLatencyEvent,
  SyncLatencyStage,
} from "@/lib/sync/sync-latency-spike";
import {
  joinTrialEvents,
  percentile,
  renderBurstResultsMarkdown,
  renderResultsMarkdown,
  summarize,
  summarizeValues,
} from "@/tests/e2e/utils/sync-latency-metrics";

function event(
  trialId: string,
  stage: SyncLatencyStage,
  wallClockMs: number,
  monotonicMs: number,
  sessionId = "session",
): SyncLatencyEvent {
  return { sessionId, trialId, stage, wallClockMs, monotonicMs };
}

describe("sync latency metrics", () => {
  it("calculates nearest-rank percentiles including small samples", () => {
    expect(percentile([], 0.5)).toBeUndefined();
    expect(percentile([7], 0.5)).toBe(7);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
    expect(percentile([4, 1, 3, 2], 0.95)).toBe(4);
    expect(() => percentile([1], 0)).toThrow(RangeError);
  });

  it("joins owner and peer stages by trial id using the documented formulas", () => {
    const trials = joinTrialEvents(
      [
        event("trial-b", "local_mutation", 2_000, 100),
        event("trial-a", "local_mutation", 1_000, 10),
        event("trial-a", "push_start", 1_020, 30),
        event("trial-a", "push_complete", 1_120, 130),
      ],
      [
        event("trial-a", "poke_received", 1_125, 200, "peer"),
        event("trial-a", "pull_start", 1_130, 205, "peer"),
        event("trial-a", "pull_complete", 1_230, 305, "peer"),
        event("trial-a", "peer_render", 1_250, 325, "peer"),
      ],
    );

    expect(trials).toContainEqual({
      trialId: "trial-a",
      metrics: {
        localToPush: 20,
        pushDuration: 100,
        pushToPoke: 5,
        pokeToPull: 5,
        pullDuration: 100,
        pullToRender: 120,
        pullCompleteToRender: 20,
        endToEnd: 250,
      },
    });
    expect(trials).toContainEqual({
      trialId: "trial-b",
      metrics: {},
    });
  });

  it("counts incomplete trials as failures per metric", () => {
    const summary = summarize([
      { trialId: "complete", metrics: { endToEnd: 400, pushDuration: 100 } },
      { trialId: "partial", metrics: { endToEnd: 500 } },
      { trialId: "failed", metrics: {} },
    ]);

    expect(summary.endToEnd).toEqual({
      p50: 400,
      p95: 500,
      max: 500,
      validN: 2,
      failures: 1,
    });
    expect(summary.pushDuration).toEqual({
      p50: 100,
      p95: 100,
      max: 100,
      validN: 1,
      failures: 2,
    });
    expect(summary.pokeToPull).toEqual({
      p50: undefined,
      p95: undefined,
      max: undefined,
      validN: 0,
      failures: 3,
    });
  });

  it("renders rows suitable for the spike report marker block", () => {
    const markdown = renderResultsMarkdown(summarize([
      { trialId: "trial-a", metrics: { localToPush: 12.6, endToEnd: 410 } },
    ]));

    expect(markdown).toContain(
      "| Local-to-push | 13 | 13 | 13 | 1 | 0 |",
    );
    expect(markdown).toContain(
      "| Push duration | Pending | Pending | Pending | 0 | 1 |",
    );
    expect(markdown).toContain(
      "| End-to-end | 410 | 410 | 410 | 1 | 0 |",
    );
  });

  it("summarizes and renders burst-level completion metrics", () => {
    const individualEndToEnd = summarizeValues([100, 200, 300], 4);
    const finalMarkerRender = summarizeValues([1_000, 1_500], 3);
    const markdown = renderBurstResultsMarkdown({
      individualEndToEnd,
      finalMarkerRender,
    });

    expect(individualEndToEnd).toEqual({
      p50: 200,
      p95: 300,
      max: 300,
      validN: 3,
      failures: 1,
    });
    expect(markdown).toContain(
      "| Individual end-to-end | 200 | 300 | 300 | 3 | 1 |",
    );
    expect(markdown).toContain(
      "| Final marker render | 1000 | 1500 | 1500 | 2 | 1 |",
    );
  });
});
