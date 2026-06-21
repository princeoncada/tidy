import { describe, expect, it } from "vitest";

import {
  movedRowOrderKey,
  sameViewOrder,
} from "@/lib/dashboard/views-reorder";

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

describe("movedRowOrderKey (workspace reorder)", () => {
  it("computes a key between the moved row's final neighbors", () => {
    const rows = [
      { id: "2", orderKey: "a1" },
      { id: "1", orderKey: "a0" },
      { id: "3", orderKey: "a2" },
    ];

    const orderKey = movedRowOrderKey(rows, "1");

    expect(orderKey).not.toBeNull();
    expect(orderKey! > rows[0].orderKey).toBe(true);
    expect(orderKey! < rows[2].orderKey).toBe(true);
  });

  it("returns only the moved row key and handles an end boundary", () => {
    const rows = [
      { id: "2", orderKey: "a1" },
      { id: "3", orderKey: "a2" },
      { id: "1", orderKey: "a0" },
    ];

    const orderKey = movedRowOrderKey(rows, "1");

    expect(typeof orderKey).toBe("string");
    expect(orderKey! > rows[1].orderKey).toBe(true);
  });
});
