import { describe, expect, it } from "vitest";

import type { DashboardSnapshot } from "@/lib/dashboard-cache";
import type { Lists } from "@/components/list/types";
import { createOutboxOperation } from "@/lib/local-db/local-repositories";
import {
  applyPendingMovementOverlay,
  translateListItemMovement,
} from "@/lib/local-db/local-movement";

function createLists(): Lists {
  return [
    {
      id: "list-a",
      name: "A",
      userId: "user-1",
      order: 0,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
      listTags: [],
      listItems: [
        {
          id: "item-1",
          name: "One",
          completed: false,
          notes: null,
          listId: "list-a",
          order: 0,
          createdAt: new Date("2026-06-11T10:00:00.000Z"),
          updatedAt: new Date("2026-06-11T10:00:00.000Z"),
        },
        {
          id: "item-2",
          name: "Two",
          completed: false,
          notes: null,
          listId: "list-a",
          order: 1,
          createdAt: new Date("2026-06-11T10:00:00.000Z"),
          updatedAt: new Date("2026-06-11T10:00:00.000Z"),
        },
      ],
    },
    {
      id: "list-b",
      name: "B",
      userId: "user-1",
      order: 1,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
      listTags: [],
      listItems: [
        {
          id: "item-3",
          name: "Three",
          completed: false,
          notes: null,
          listId: "list-b",
          order: 0,
          createdAt: new Date("2026-06-11T10:00:00.000Z"),
          updatedAt: new Date("2026-06-11T10:00:00.000Z"),
        },
      ],
    },
  ] as Lists;
}

function createSnapshot(lists = createLists()): DashboardSnapshot {
  return {
    view: {
      id: "view-1",
      name: "All Lists",
      userId: "user-1",
      order: 0,
      type: "ALL_LISTS",
      isDefault: true,
      matchMode: "ALL",
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
      viewTags: [],
      viewLists: lists.map((list) => ({
        viewId: "view-1",
        listId: list.id,
        order: list.order,
      })),
    },
    lists,
  } as DashboardSnapshot;
}

describe("local movement translation and overlay", () => {
  it("emits move before destination and source reorder intents", () => {
    const previous = createLists();
    const next = createLists();
    const [moved] = next[0].listItems.splice(0, 1);
    next[1].listItems.push({ ...moved, listId: "list-b", order: 1 });
    next[0].listItems = next[0].listItems.map((item, order) => ({
      ...item,
      order,
    }));

    expect(translateListItemMovement(previous, next)).toEqual([
      {
        type: "move",
        itemId: "item-1",
        toListId: "list-b",
        order: 1,
      },
      {
        type: "reorder",
        listId: "list-b",
        orderedItemIds: ["item-3", "item-1"],
      },
      {
        type: "reorder",
        listId: "list-a",
        orderedItemIds: ["item-2"],
      },
    ]);
  });

  it("excludes optimistic rows from reorder intents", () => {
    const previous = createLists();
    const next = createLists();
    next[0].listItems = [
      { ...next[0].listItems[1], order: 0 },
      { ...next[0].listItems[0], order: 1 },
      {
        ...next[0].listItems[0],
        id: "optimistic-item",
        order: 2,
        isOptimistic: true,
      },
    ] as Lists[number]["listItems"];

    expect(translateListItemMovement(previous, next)).toEqual([
      {
        type: "reorder",
        listId: "list-a",
        orderedItemIds: ["item-2", "item-1"],
      },
    ]);
  });

  it("reapplies pending list order and cross-list placement to a stale snapshot", () => {
    const snapshot = createSnapshot();
    const operations = [
      createOutboxOperation({
        operationId: "op-list-order",
        userId: "user-1",
        entityType: "viewList",
        entityClientId: "view-1",
        operationType: "reorder",
        payload: {
          viewId: "view-1",
          orderedIds: ["list-b", "list-a"],
        },
        createdAt: "2026-06-11T10:00:00.000Z",
      }),
      createOutboxOperation({
        operationId: "op-move",
        userId: "user-1",
        entityType: "listItem",
        entityClientId: "item-1",
        operationType: "move",
        payload: { toListClientId: "list-b", order: 1 },
        createdAt: "2026-06-11T10:00:00.001Z",
      }),
      createOutboxOperation({
        operationId: "op-destination",
        userId: "user-1",
        entityType: "listItem",
        entityClientId: "list-b",
        operationType: "reorder",
        payload: {
          listId: "list-b",
          orderedIds: ["item-3", "item-1"],
        },
        createdAt: "2026-06-11T10:00:00.002Z",
      }),
      createOutboxOperation({
        operationId: "op-source",
        userId: "user-1",
        entityType: "listItem",
        entityClientId: "list-a",
        operationType: "reorder",
        payload: { listId: "list-a", orderedIds: ["item-2"] },
        createdAt: "2026-06-11T10:00:00.003Z",
      }),
    ];

    const overlaid = applyPendingMovementOverlay(snapshot, operations);

    expect(overlaid.lists.map((list) => list.id)).toEqual([
      "list-b",
      "list-a",
    ]);
    expect(overlaid.lists[0].listItems.map((item) => item.id)).toEqual([
      "item-3",
      "item-1",
    ]);
    expect(overlaid.lists[0].listItems[1]).toMatchObject({
      listId: "list-b",
      order: 1,
    });
    expect(overlaid.lists[1].listItems.map((item) => item.id)).toEqual([
      "item-2",
    ]);
  });
});
