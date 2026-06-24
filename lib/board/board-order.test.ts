import { describe, expect, it } from "vitest";

import {
  boardKeyForDrop,
  compareBoardItems,
  groupItemsByStatus,
  type BoardCardItem,
} from "@/lib/board/board-order";
import { initialKeys, keyBetween } from "@/lib/sync/fractional-index";

function item(overrides: Partial<BoardCardItem>): BoardCardItem {
  return {
    id: "item-1",
    name: "Task",
    listId: "list-1",
    status: "TODO",
    boardOrderKey: null,
    order: "a0",
    ...overrides,
  };
}

describe("board ordering", () => {
  it("sorts real board keys before legacy nulls", () => {
    const [firstKey] = initialKeys(1);
    const items = [
      item({ id: "legacy", boardOrderKey: null, order: "a0" }),
      item({ id: "keyed", boardOrderKey: firstKey, order: "z0" }),
    ].sort(compareBoardItems);

    expect(items.map((entry) => entry.id)).toEqual(["keyed", "legacy"]);
  });

  it("sorts ascending board keys with id ties", () => {
    const [firstKey, secondKey] = initialKeys(2);
    const items = [
      item({ id: "c", boardOrderKey: secondKey }),
      item({ id: "b", boardOrderKey: firstKey }),
      item({ id: "a", boardOrderKey: firstKey }),
    ].sort(compareBoardItems);

    expect(items.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts legacy nulls by list order then id", () => {
    const items = [
      item({ id: "c", order: "b0" }),
      item({ id: "b", order: "a0" }),
      item({ id: "a", order: "a0" }),
    ].sort(compareBoardItems);

    expect(items.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("groups by status and sorts each bucket", () => {
    const [firstKey, secondKey] = initialKeys(2);
    const grouped = groupItemsByStatus([
      item({ id: "done", status: "DONE", boardOrderKey: secondKey }),
      item({ id: "todo", status: "TODO", boardOrderKey: firstKey }),
      item({ id: "progress", status: "IN_PROGRESS", boardOrderKey: firstKey }),
      item({ id: "done-first", status: "DONE", boardOrderKey: firstKey }),
    ]);

    expect(grouped.TODO.map((entry) => entry.id)).toEqual(["todo"]);
    expect(grouped.IN_PROGRESS.map((entry) => entry.id)).toEqual(["progress"]);
    expect(grouped.DONE.map((entry) => entry.id)).toEqual([
      "done-first",
      "done",
    ]);
  });

  it("returns a key strictly between two real neighbors", () => {
    const [before, after] = initialKeys(2);
    const key = boardKeyForDrop(
      [
        item({ id: "before", boardOrderKey: before }),
        item({ id: "after", boardOrderKey: after }),
      ],
      1,
    );

    expect(key > before).toBe(true);
    expect(key < after).toBe(true);
  });

  it("returns valid keys at both ends and for an empty column", () => {
    const [first, second] = initialKeys(2);
    const column = [
      item({ id: "first", boardOrderKey: first }),
      item({ id: "second", boardOrderKey: second }),
    ];

    expect(boardKeyForDrop(column, 0) < first).toBe(true);
    expect(boardKeyForDrop(column, 2) > second).toBe(true);
    expect(boardKeyForDrop([], 0)).toBe(initialKeys(1)[0]);
  });

  it("scans past null neighbors before generating a drop key", () => {
    const [before, after] = initialKeys(2);
    const key = boardKeyForDrop(
      [
        item({ id: "before", boardOrderKey: before }),
        item({ id: "legacy-a", boardOrderKey: null }),
        item({ id: "legacy-b", boardOrderKey: null }),
        item({ id: "after", boardOrderKey: after }),
      ],
      2,
    );

    expect(key).toBe(keyBetween(before, after));
  });
});
