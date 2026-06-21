import { describe, expect, it } from "vitest";

import {
  itemPlacementMatches,
  listOrderMatches,
} from "@/lib/dashboard/list-items-reorder";

const list = (id: string, items: { id: string; listId: string }[]) => ({
  id,
  listItems: items,
});
const item = (id: string, listId: string) => ({ id, listId });

describe("listOrderMatches (drag relinquish gate)", () => {
  it("true when same ids in same order", () => {
    expect(listOrderMatches([{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "b" }])).toBe(true);
  });

  it("false when order differs", () => {
    expect(listOrderMatches([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "a" }])).toBe(false);
  });

  it("false when lengths differ", () => {
    expect(listOrderMatches([{ id: "a" }], [{ id: "a" }, { id: "b" }])).toBe(false);
  });
});

describe("itemPlacementMatches (cross-list move relinquish gate)", () => {
  it("true when committed placement equals preview", () => {
    const committed = [list("L1", [item("i1", "L1")]), list("L2", [item("i2", "L2")])];
    const preview = [list("L1", [item("i1", "L1")]), list("L2", [item("i2", "L2")])];
    expect(itemPlacementMatches(committed, preview)).toBe(true);
  });

  it("false while a cross-list move has not committed (item still in source)", () => {
    const committed = [list("L1", [item("i1", "L1")]), list("L2", [item("i2", "L2")])];
    const preview = [list("L1", []), list("L2", [item("i2", "L2"), item("i1", "L2")])];
    expect(itemPlacementMatches(committed, preview)).toBe(false);
  });

  it("true once the moved item's listId and position converge", () => {
    const moved = [list("L1", []), list("L2", [item("i2", "L2"), item("i1", "L2")])];
    const same = moved.map((l) => ({ id: l.id, listItems: l.listItems.map((i) => ({ ...i })) }));
    expect(itemPlacementMatches(moved, same)).toBe(true);
  });

  it("false when only listId differs", () => {
    expect(
      itemPlacementMatches([list("L1", [item("i1", "L1")])], [list("L1", [item("i1", "L2")])]),
    ).toBe(false);
  });

  it("ignores non-structural fields", () => {
    const committed = [{ id: "L1", order: 0, listItems: [{ id: "i1", listId: "L1", order: 0 }] }];
    const preview = [{ id: "L1", order: 9, listItems: [{ id: "i1", listId: "L1", order: 7 }] }];
    expect(itemPlacementMatches(committed, preview)).toBe(true);
  });
});
