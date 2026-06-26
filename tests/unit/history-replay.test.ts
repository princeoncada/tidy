import { describe, expect, it } from "vitest";

import { replayMutationLedgerEntries } from "@/lib/history/replay";
import { initialKeys, keyBetween } from "@/lib/sync/fractional-index";
import { replicacheKeys } from "@/lib/sync/replicache/keys";

const now = "2026-06-26T01:00:00.000Z";

describe("history replay", () => {
  it("replays known mutators in order and skips unknown names", async () => {
    const [listOrder, firstItemOrder, secondItemOrder] = initialKeys(3);
    const movedOrder = keyBetween(secondItemOrder, null);
    const entries = [
      {
        name: "createList",
        args: {
          id: "list-1",
          userId: "user-1",
          name: "Inbox",
          allListsViewId: "view-all",
          order: listOrder,
          now,
        },
      },
      { name: "unknownMutator", args: { id: "ignored" } },
      {
        name: "createItem",
        args: {
          id: "item-1",
          listId: "list-1",
          name: "First",
          order: firstItemOrder,
          now,
        },
      },
      {
        name: "createItem",
        args: {
          id: "item-2",
          listId: "list-1",
          name: "Second",
          order: secondItemOrder,
          now,
        },
      },
      {
        name: "renameList",
        args: {
          id: "list-1",
          name: "Renamed",
          now: "2026-06-26T01:01:00.000Z",
        },
      },
      {
        name: "moveItem",
        args: {
          id: "item-2",
          fromListId: "list-1",
          toListId: "list-2",
          order: movedOrder,
          now: "2026-06-26T01:02:00.000Z",
        },
      },
      { name: "deleteItem", args: { id: "item-1" } },
    ];

    const state = await replayMutationLedgerEntries(entries);
    expect(state[replicacheKeys.list("list-1")]).toMatchObject({
      id: "list-1",
      name: "Renamed",
    });
    expect(state[replicacheKeys.listItem("item-1")]).toBeUndefined();
    expect(state[replicacheKeys.listItem("item-2")]).toMatchObject({
      id: "item-2",
      listId: "list-2",
      order: movedOrder,
    });
  });

  it("replays a sliced prefix to the earlier state", async () => {
    const [listOrder] = initialKeys(1);
    const entries = [
      {
        name: "createList",
        args: {
          id: "list-1",
          userId: "user-1",
          name: "Inbox",
          allListsViewId: "view-all",
          order: listOrder,
          now,
        },
      },
      {
        name: "renameList",
        args: {
          id: "list-1",
          name: "Renamed",
          now: "2026-06-26T01:01:00.000Z",
        },
      },
    ];

    await expect(replayMutationLedgerEntries(entries.slice(0, 1)))
      .resolves.toMatchObject({
        [replicacheKeys.list("list-1")]: expect.objectContaining({
          name: "Inbox",
        }),
      });
  });
});
