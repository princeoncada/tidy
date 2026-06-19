import { describe, expect, it, vi } from "vitest";

import {
  isSyncLatencySpikeEnabled,
  measureSyncLatencyOperation,
  SyncLatencyRecorder,
  wrapSyncLatencyMutators,
} from "@/lib/sync/sync-latency-spike";

function createRecorder({
  enabled = true,
  maxEvents = 100,
}: {
  enabled?: boolean;
  maxEvents?: number;
} = {}) {
  let wallClockMs = 1_000;
  let monotonicMs = 10;
  return new SyncLatencyRecorder({
    enabled,
    maxEvents,
    sessionId: "session-1",
    wallClockNow: () => wallClockMs++,
    monotonicNow: () => monotonicMs++,
  });
}

describe("sync latency spike gate", () => {
  it("enables only when the development storage flag is set", () => {
    expect(
      isSyncLatencySpikeEnabled({
        nodeEnv: "development",
        storage: { getItem: () => "1" },
      }),
    ).toBe(true);
    expect(
      isSyncLatencySpikeEnabled({
        nodeEnv: "development",
        storage: { getItem: () => null },
      }),
    ).toBe(false);
  });

  it("is disabled in production and when storage is unavailable", () => {
    const enabledStorage = { getItem: vi.fn(() => "1") };

    expect(
      isSyncLatencySpikeEnabled({
        nodeEnv: "production",
        storage: enabledStorage,
      }),
    ).toBe(false);
    expect(
      isSyncLatencySpikeEnabled({ nodeEnv: "development", storage: null }),
    ).toBe(false);
    expect(enabledStorage.getItem).not.toHaveBeenCalled();
  });

  it("fails closed when storage access throws", () => {
    expect(
      isSyncLatencySpikeEnabled({
        nodeEnv: "development",
        storage: {
          getItem: () => {
            throw new Error("storage blocked");
          },
        },
      }),
    ).toBe(false);
  });
});

describe("SyncLatencyRecorder", () => {
  it("records ordered correlated stages with comparable timestamps", () => {
    const recorder = createRecorder();
    recorder.startTrial("baseline-01");

    recorder.record("local_mutation", { mutationName: "updateList" });
    recorder.record("push_start");
    recorder.record("push_complete", { httpStatusCode: 200 });

    expect(recorder.events()).toEqual([
      {
        sessionId: "session-1",
        trialId: "baseline-01",
        stage: "local_mutation",
        wallClockMs: 1_000,
        monotonicMs: 10,
        details: { mutationName: "updateList" },
      },
      {
        sessionId: "session-1",
        trialId: "baseline-01",
        stage: "push_start",
        wallClockMs: 1_001,
        monotonicMs: 11,
      },
      {
        sessionId: "session-1",
        trialId: "baseline-01",
        stage: "push_complete",
        wallClockMs: 1_002,
        monotonicMs: 12,
        details: { httpStatusCode: 200 },
      },
    ]);
  });

  it("keeps trials separate and exports only the bounded event window", () => {
    const recorder = createRecorder({ maxEvents: 2 });
    recorder.startTrial("trial-a");
    recorder.record("local_mutation");
    recorder.record("push_start");
    recorder.startTrial("trial-b");
    recorder.record("poke_received");

    const events = recorder.events();
    expect(events.map((event) => event.trialId)).toEqual([
      "trial-a",
      "trial-b",
    ]);
    expect(JSON.parse(recorder.exportJson())).toEqual(events);

    recorder.clear();
    expect(recorder.events()).toEqual([]);
  });

  it("does not synthesize missing stages or record while disabled", () => {
    const enabledRecorder = createRecorder();
    enabledRecorder.startTrial("partial");
    enabledRecorder.record("pull_start");
    expect(enabledRecorder.events().map((event) => event.stage)).toEqual([
      "pull_start",
    ]);

    const disabledRecorder = createRecorder({ enabled: false });
    disabledRecorder.startTrial("disabled");
    disabledRecorder.record("local_mutation");
    expect(disabledRecorder.events()).toEqual([]);
  });
});

describe("sync latency wrappers", () => {
  it("returns the original mutator surface when disabled", () => {
    const mutators = { updateList: vi.fn(() => "unchanged") };

    expect(
      wrapSyncLatencyMutators(
        mutators,
        createRecorder({ enabled: false }),
      ),
    ).toBe(mutators);
  });

  it("preserves mutator results and exceptions while recording safe metadata", () => {
    const expectedError = new Error("mutation failed");
    const mutators = {
      updateList: vi.fn(({ id }: { id: string }) => `updated:${id}`),
      fail: vi.fn(() => {
        throw expectedError;
      }),
    };
    const recorder = createRecorder();
    recorder.startTrial("mutations");
    const wrapped = wrapSyncLatencyMutators(mutators, recorder);

    expect(wrapped.updateList({ id: "list-1" })).toBe("updated:list-1");
    expect(() => wrapped.fail()).toThrow(expectedError);
    expect(recorder.events().map((event) => event.details)).toEqual([
      { mutationName: "updateList", entityId: "list-1" },
      { mutationName: "fail" },
    ]);
  });

  it("preserves measured operation results and rejection identity", async () => {
    const recorder = createRecorder();
    recorder.startTrial("network");

    await expect(
      measureSyncLatencyOperation(
        {
          startStage: "push_start",
          completeStage: "push_complete",
          failureStage: "push_failure",
        },
        async () => "ok",
        recorder,
      ),
    ).resolves.toBe("ok");

    const expectedError = new Error("network failed");
    await expect(
      measureSyncLatencyOperation(
        {
          startStage: "pull_start",
          completeStage: "pull_complete",
          failureStage: "pull_failure",
        },
        async () => {
          throw expectedError;
        },
        recorder,
      ),
    ).rejects.toBe(expectedError);

    expect(recorder.events().map((event) => event.stage)).toEqual([
      "push_start",
      "push_complete",
      "pull_start",
      "pull_failure",
    ]);
  });
});
