import { afterEach, describe, expect, it } from "vitest";

import { isItemPanelEnabled } from "@/lib/item-panel/item-panel-gate";

describe("isItemPanelEnabled", () => {
  const originalValue = process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED = originalValue;
    }
  });

  it("enables the panel only for exactly true", () => {
    delete process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED;
    expect(isItemPanelEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED = "false";
    expect(isItemPanelEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ITEM_PANEL_ENABLED = "true";
    expect(isItemPanelEnabled()).toBe(true);
  });
});
