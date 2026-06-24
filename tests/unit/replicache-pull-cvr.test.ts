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

  it("keeps client-group cookies ordered across digit boundaries", () => {
    const nine = nextReplicacheCookie("group-1:8", "group-1");
    const ten = nextReplicacheCookie("group-1:9", "group-1");
    const ninetyNine = nextReplicacheCookie("group-1:98", "group-1");
    const hundred = nextReplicacheCookie("group-1:99", "group-1");
    const fortyOne = nextReplicacheCookie("group-1:40", "group-1");

    expect(nine < ten).toBe(true);
    expect(nine < ninetyNine).toBe(true);
    expect(ninetyNine < hundred).toBe(true);
    expect(nine < fortyOne).toBe(true);
  });

  it("uses one fixed-width sequence suffix for every magnitude", () => {
    const suffixLengths = [
      nextReplicacheCookie(null, "group-1"),
      nextReplicacheCookie("group-1:9", "group-1"),
      nextReplicacheCookie("group-1:99", "group-1"),
      nextReplicacheCookie("group-1:999999", "group-1"),
    ].map((cookie) => cookie.split(":").at(-1)?.length);

    expect(new Set(suffixLengths)).toEqual(new Set([16]));
  });

  it("starts null and undefined cookies at a zero-padded sequence one", () => {
    expect(nextReplicacheCookie(null, "group-1")).toBe(
      "group-1:0000000000000001",
    );
    expect(nextReplicacheCookie(undefined, "group-1")).toBe(
      "group-1:0000000000000001",
    );
  });

  it("round-trips a generated cookie and increments by exactly one", () => {
    const first = nextReplicacheCookie(null, "group-1");
    const second = nextReplicacheCookie(first, "group-1");
    const firstSequence = Number(first.split(":").at(-1));
    const secondSequence = Number(second.split(":").at(-1));

    expect(secondSequence).toBe(firstSequence + 1);
  });

  it("returns a bare zero-padded sequence without a client group id", () => {
    expect(nextReplicacheCookie(null)).toBe("0000000000000001");
    expect(nextReplicacheCookie("0000000000000009")).toBe(
      "0000000000000010",
    );
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
            { id: "item-a", listId: "list-a", name: "A", order: 0, orderKey: null, boardOrderKey: null, completed: false, status: "TODO", assigneeId: null, notes: null, createdAt: now, updatedAt: now },
            { id: "item-b", listId: "list-a", name: "B", order: 1, orderKey: null, boardOrderKey: null, completed: false, status: "IN_PROGRESS", assigneeId: "user-2", notes: null, createdAt: now, updatedAt: now },
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
    expect(view[replicacheKeys.listItem("item-a")].value).toMatchObject({
      status: "TODO",
      assigneeId: null,
      boardOrderKey: null,
    });
    expect(view[replicacheKeys.listItem("item-b")].value).toMatchObject({
      status: "IN_PROGRESS",
      assigneeId: "user-2",
      boardOrderKey: null,
    });
    expect(() =>
      keyBetween(firstMembership.order, secondMembership.order)
    ).not.toThrow();
    expect(() => keyBetween(firstItem.order, secondItem.order)).not.toThrow();
  });

  it("projects assigned and unassigned workspace ids onto list values", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    const view = buildReplicacheClientView({
      views: [],
      allLists: {
        view: {} as never,
        lists: [
          {
            id: "assigned-list",
            userId: "user-1",
            name: "Assigned",
            workspaceId: "workspace-1",
            createdAt: now,
            updatedAt: now,
            listTags: [],
            listItems: [],
          },
          {
            id: "unassigned-list",
            userId: "user-1",
            name: "Unassigned",
            workspaceId: null,
            createdAt: now,
            updatedAt: now,
            listTags: [],
            listItems: [],
          },
        ],
      } as never,
      tags: [],
    });

    expect(view[replicacheKeys.list("assigned-list")].value).toMatchObject({
      workspaceId: "workspace-1",
    });
    expect(view[replicacheKeys.list("unassigned-list")].value).toMatchObject({
      workspaceId: null,
    });
  });
});

