import { describe, expect, it } from "vitest";

import { buildRevertPlan } from "@/lib/history/revert-plan";
import { replicacheKeys } from "@/lib/sync/replicache/keys";
import type { ReplicacheClientView } from "@/lib/sync/replicache/pull-cvr";

const list = {
  id: "list-1",
  userId: "user-1",
  name: "Inbox",
  workspaceId: null,
  createdAt: "2026-06-26T01:00:00.000Z",
  updatedAt: "2026-06-26T01:00:00.000Z",
};

const renamedList = {
  ...list,
  name: "Renamed",
  updatedAt: "2026-06-26T01:01:00.000Z",
};

const item = {
  id: "item-1",
  listId: "list-1",
  name: "Task",
  completed: false,
  status: "TODO" as const,
  assigneeId: null,
  order: "a0",
  boardOrderKey: "a0",
  notes: null,
  createdAt: "2026-06-26T01:00:00.000Z",
  updatedAt: "2026-06-26T01:00:00.000Z",
};

function view(values: Record<string, unknown>): ReplicacheClientView {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      { hash: key, value },
    ]),
  ) as ReplicacheClientView;
}

describe("history revert plan", () => {
  it("plans bounded upserts, deletes, no-ops, and FK-safe ordering", () => {
    const listKey = replicacheKeys.list("list-1");
    const itemKey = replicacheKeys.listItem("item-1");
    const deletedItemKey = replicacheKeys.listItem("item-2");
    const ignoredTagKey = replicacheKeys.tag("tag-1");
    const target = {
      [listKey]: list,
      [itemKey]: {
        ...item,
        name: "Task restored",
        order: "a1",
      },
      [ignoredTagKey]: {
        id: "tag-1",
        userId: "user-1",
        name: "Ignored",
        color: "gray",
        createdAt: "2026-06-26T01:00:00.000Z",
        updatedAt: "2026-06-26T01:00:00.000Z",
      },
    };
    const current = view({
      [listKey]: renamedList,
      [itemKey]: item,
      [deletedItemKey]: {
        ...item,
        id: "item-2",
        name: "Delete me",
      },
      [ignoredTagKey]: {
        id: "tag-1",
        userId: "user-1",
        name: "Changed but out of bounds",
        color: "red",
        createdAt: "2026-06-26T01:00:00.000Z",
        updatedAt: "2026-06-26T01:02:00.000Z",
      },
    });

    const plan = buildRevertPlan({
      current,
      target,
      affectedKeys: new Set([listKey, itemKey, deletedItemKey]),
    });

    expect(plan.map((decision) => [
      decision.operation.entityType,
      decision.operation.operationType,
      decision.operation.entityClientId,
      decision.operation.payload,
    ])).toEqual([
      ["listItem", "delete", "item-2", { deleted: true }],
      ["list", "update", "list-1", { name: "Inbox" }],
      ["listItem", "reorder", "item-1", {
        listId: "list-1",
        itemId: "item-1",
        orderKey: "a1",
      }],
      ["listItem", "update", "item-1", { name: "Task restored" }],
    ]);
  });

  it("plans a create when the target key is missing in current", () => {
    const listKey = replicacheKeys.list("list-1");

    const plan = buildRevertPlan({
      current: view({}),
      target: { [listKey]: list },
      affectedKeys: new Set([listKey]),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]?.operation).toMatchObject({
      entityType: "list",
      operationType: "create",
      entityClientId: "list-1",
      payload: { name: "Inbox" },
    });
  });
});
