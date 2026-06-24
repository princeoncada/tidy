import { afterEach, describe, expect, it } from "vitest";

import { isPresenceEnabled } from "@/lib/realtime/presence-gate";

describe("isPresenceEnabled", () => {
  const originalValue = process.env.NEXT_PUBLIC_PRESENCE_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_PRESENCE_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_PRESENCE_ENABLED = originalValue;
    }
  });

  it("enables presence only for exactly true", () => {
    delete process.env.NEXT_PUBLIC_PRESENCE_ENABLED;
    expect(isPresenceEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_PRESENCE_ENABLED = "false";
    expect(isPresenceEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_PRESENCE_ENABLED = "true";
    expect(isPresenceEnabled()).toBe(true);
  });
});
