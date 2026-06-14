import { describe, expect, it } from "vitest";

import {
  diffReplicacheClientViews,
  nextReplicacheCookie,
  toReplicacheClientViewRecordHashes,
  type ReplicacheClientView,
} from "@/lib/sync/replicache/pull-cvr";

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
});

