import { describe, expect, it } from "vitest";

import { computeBoardRollup } from "@/lib/board/board-rollup";
import { type BoardCardItem } from "@/lib/board/board-order";
import type { ItemStatus } from "@/lib/sync/replicache/keys";

function groups(
  counts: Partial<Record<ItemStatus, number>>,
): Record<ItemStatus, BoardCardItem[]> {
  const make = (status: ItemStatus, n: number): BoardCardItem[] =>
    Array.from({ length: n }, (_, index) => ({
      id: status + "-" + index,
      name: "Task",
      listId: "list-1",
      status,
      boardOrderKey: null,
      order: "a0",
    }));

  return {
    TODO: make("TODO", counts.TODO ?? 0),
    IN_PROGRESS: make("IN_PROGRESS", counts.IN_PROGRESS ?? 0),
    DONE: make("DONE", counts.DONE ?? 0),
  };
}

describe("computeBoardRollup", () => {
  it("returns zeroes and 0% for an empty board", () => {
    const rollup = computeBoardRollup(groups({}));

    expect(rollup.counts).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
    expect(rollup.total).toBe(0);
    expect(rollup.completionPercent).toBe(0);
  });

  it("counts each column and totals them", () => {
    const rollup = computeBoardRollup(
      groups({ TODO: 2, IN_PROGRESS: 1, DONE: 1 }),
    );

    expect(rollup.counts).toEqual({ TODO: 2, IN_PROGRESS: 1, DONE: 1 });
    expect(rollup.total).toBe(4);
    expect(rollup.completionPercent).toBe(25);
  });

  it("reports 100% when every item is done", () => {
    const rollup = computeBoardRollup(groups({ DONE: 3 }));

    expect(rollup.completionPercent).toBe(100);
  });

  it("rounds the completion percentage to the nearest whole number", () => {
    const rollup = computeBoardRollup(groups({ TODO: 2, DONE: 1 }));

    expect(rollup.completionPercent).toBe(33);
  });
});
