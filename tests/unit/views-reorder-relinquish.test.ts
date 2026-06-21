import { describe, expect, it } from "vitest";

import { sameViewOrder } from "@/lib/dashboard/views-reorder";

describe("sameViewOrder (views reorder relinquish gate)", () => {
  it("returns true when both lists hold the same ids in the same order", () => {
    const saved = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const preview = [{ id: "1" }, { id: "2" }, { id: "3" }];

    expect(sameViewOrder(saved, preview)).toBe(true);
  });

  it("returns false while the committed order has not caught up to the preview", () => {
    const saved = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const preview = [{ id: "2" }, { id: "1" }, { id: "3" }];

    expect(sameViewOrder(saved, preview)).toBe(false);
  });

  it("returns false when the lengths differ", () => {
    expect(sameViewOrder([{ id: "1" }], [{ id: "1" }, { id: "2" }])).toBe(false);
  });

  it("compares ids only, ignoring other fields", () => {
    const saved = [{ id: "1", order: 0 }, { id: "2", order: 1 }];
    const preview = [{ id: "1", order: 9 }, { id: "2", order: 4 }];

    expect(sameViewOrder(saved, preview)).toBe(true);
  });
});
