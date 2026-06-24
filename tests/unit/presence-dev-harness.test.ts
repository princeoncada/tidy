import { describe, expect, it, vi } from "vitest";

import { isPresenceSpikeEnabled } from "@/lib/realtime/presence-dev-harness";

describe("presence spike gate", () => {
  it("enables only when the development storage flag is set", () => {
    expect(
      isPresenceSpikeEnabled({
        nodeEnv: "development",
        storage: { getItem: () => "1" },
      }),
    ).toBe(true);
    expect(
      isPresenceSpikeEnabled({
        nodeEnv: "development",
        storage: { getItem: () => null },
      }),
    ).toBe(false);
    expect(
      isPresenceSpikeEnabled({
        nodeEnv: "development",
        storage: { getItem: () => "true" },
      }),
    ).toBe(false);
  });

  it("is disabled in production and when storage is unavailable", () => {
    const enabledStorage = { getItem: vi.fn(() => "1") };

    expect(
      isPresenceSpikeEnabled({
        nodeEnv: "production",
        storage: enabledStorage,
      }),
    ).toBe(false);
    expect(
      isPresenceSpikeEnabled({ nodeEnv: "development", storage: null }),
    ).toBe(false);
    expect(enabledStorage.getItem).not.toHaveBeenCalled();
  });

  it("fails closed when storage access throws", () => {
    expect(
      isPresenceSpikeEnabled({
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
