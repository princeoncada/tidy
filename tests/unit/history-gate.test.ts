import { afterEach, describe, expect, it } from "vitest";

import { isHistoryEnabled } from "@/lib/history/history-gate";

describe("isHistoryEnabled", () => {
  const originalValue = process.env.NEXT_PUBLIC_HISTORY_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_HISTORY_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_HISTORY_ENABLED = originalValue;
    }
  });

  it("enables history only for exactly true", () => {
    delete process.env.NEXT_PUBLIC_HISTORY_ENABLED;
    expect(isHistoryEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_HISTORY_ENABLED = "false";
    expect(isHistoryEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_HISTORY_ENABLED = "true";
    expect(isHistoryEnabled()).toBe(true);
  });
});
