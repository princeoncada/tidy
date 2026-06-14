import { describe, expect, it } from "vitest";

import {
  buildReplicacheClientView,
  diffReplicacheClientViews,
  nextReplicacheCookie,
  toReplicacheClientViewRecordHashes,
  type ReplicacheClientView,
} from "@/lib/sync/replicache/pull-cvr";
import { keyBetween } from "@/lib/sync/fractional-index";
import { replicacheKeys } from "@/lib/sync/replicache/keys";

describe("Replicache CVR pull diff", () => {
  it("puts new and changed values and deletes hard-removed keys", () => {
    const current: ReplicacheClientView = {
      "list/list-1": {
        hash: "new-list-hash",
        value: { id: "list-1", name: "Renamed" },
      },
      "tag/tag-1": {
        hash: "tag-hash",
        value: { id: "tag-1", name: "Work" },
      },
    };

    expect(
      diffReplicacheClientViews({
        previous: {
          "list/list-1": "old-list-hash",
          "listItem/deleted-item": "deleted-item-hash",
        },
        current,
      }),
    ).toEqual([
      {
        op: "put",
        key: "list/list-1",
        value: { id: "list-1", name: "Renamed" },
      },
      {
        op: "put",
        key: "tag/tag-1",
        value: { id: "tag-1", name: "Work" },
      },
      { op: "del", key: "listItem/deleted-item" },
    ]);
  });

  it("stores only hashes in the persisted CVR", () => {
    expect(
      toReplicacheClientViewRecordHashes({
        "list/list-1": {
          hash: "hash-1",
          value: { id: "list-1" },
        },
      }),
    ).toEqual({ "list/list-1": "hash-1" });
  });

  it("issues monotonic client-group cookies", () => {
    expect(nextReplicacheCookie(null, "group-1")).toBe("group-1:1");
    expect(nextReplicacheCookie("group-1:9", "group-1")).toBe("group-1:10");
  });

  it("supplies deterministic valid fallback keys for nullable server rows", () => {
    const now = new Date("2026-06-14T12:00:00.000Z");
    const view = buildReplicacheClientView({
      views: [{
        id: "view-all",
        userId: "user-1",
        name: "All Lists",
        order: 0,
        orderKey: null,
        type: "ALL_LISTS",
        isDefault: true,
        matchMode: "ALL",
        createdAt: now,
        updatedAt: now,
        viewTags: [],
        viewLists: [
          { listId: "list-a", order: 0, orderKey: null },
          { listId: "list-b", order: 1, orderKey: null },
        ],
      }] as never,
      allLists: {
        view: {} as never,
        lists: [{
          id: "list-a",
          userId: "user-1",
          name: "A",
          order: 0,
          orderKey: null,
          createdAt: now,
          updatedAt: now,
          listTags: [],
          listItems: [
            { id: "item-a", listId: "list-a", name: "A", order: 0, orderKey: null, completed: false, notes: null, createdAt: now, updatedAt: now },
            { id: "item-b", listId: "list-a", name: "B", order: 1, orderKey: null, completed: false, notes: null, createdAt: now, updatedAt: now },
          ],
        }],
      } as never,
      tags: [] as never,
    });

    const firstMembership = view[
      replicacheKeys.viewList("view-all", "list-a")
    ].value as { order: string };
    const secondMembership = view[
      replicacheKeys.viewList("view-all", "list-b")
    ].value as { order: string };
    const firstItem = view[replicacheKeys.listItem("item-a")]
      .value as { order: string };
    const secondItem = view[replicacheKeys.listItem("item-b")]
      .value as { order: string };

    expect(firstMembership.order < secondMembership.order).toBe(true);
    expect(firstItem.order < secondItem.order).toBe(true);
    expect(() =>
      keyBetween(firstMembership.order, secondMembership.order)
    ).not.toThrow();
    expect(() => keyBetween(firstItem.order, secondItem.order)).not.toThrow();
  });
});

