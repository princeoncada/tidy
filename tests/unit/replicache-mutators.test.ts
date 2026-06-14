import { describe, expect, it } from "vitest";

import {
  replicacheMutators,
  translateReplicacheMutation,
} from "@/lib/sync/replicache/mutators";
import { replicacheKeys } from "@/lib/sync/replicache/keys";

function createTransaction(seed: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(seed));
  const tx = {
    mutationID: 1,
    reason: "initial" as const,
    location: "client" as const,
    environment: "client" as const,
    clientID: "client-1",
    get: async (key: string) => store.get(key),
    has: async (key: string) => store.has(key),
    isEmpty: async () => store.size === 0,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    put: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    del: async (key: string) => store.delete(key),
    scan: ({ prefix = "" }: { prefix?: string } = {}) => {
      const entries = [...store.entries()].filter(([key]) =>
        key.startsWith(prefix)
      );
      return {
        entries: () => ({ toArray: async () => entries }),
        values: () => ({ toArray: async () => entries.map(([, value]) => value) }),
        keys: () => ({ toArray: async () => entries.map(([key]) => key) }),
        [Symbol.asyncIterator]: async function* () {
          for (const [, value] of entries) yield value;
        },
      };
    },
  };

  return { tx: tx as never, store };
}

describe("Replicache dashboard mutators", () => {
  it("creates a list with All Lists membership and inherited tags", async () => {
    const { tx, store } = createTransaction();

    await replicacheMutators.createList(tx, {
      id: "list-1",
      userId: "user-1",
      name: "Inbox",
      allListsViewId: "view-all",
      order: -1,
      inheritedTagIds: ["tag-1"],
      now: "2026-06-14T12:00:00.000Z",
    });

    expect(store.get(replicacheKeys.list("list-1"))).toMatchObject({
      id: "list-1",
      name: "Inbox",
    });
    expect(store.get(replicacheKeys.viewList("view-all", "list-1"))).toEqual({
      viewId: "view-all",
      listId: "list-1",
      order: -1,
    });
    expect(store.has(replicacheKeys.listTag("list-1", "tag-1"))).toBe(true);
  });

  it("uses one move mutator to update cross-list placement and both orders", async () => {
    const now = "2026-06-14T12:00:00.000Z";
    const { tx, store } = createTransaction({
      [replicacheKeys.listItem("item-1")]: {
        id: "item-1",
        listId: "list-a",
        name: "Move me",
        order: 0,
        completed: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      [replicacheKeys.listItem("item-2")]: {
        id: "item-2",
        listId: "list-b",
        name: "Existing",
        order: 0,
        completed: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await replicacheMutators.moveItem(tx, {
      id: "item-1",
      fromListId: "list-a",
      toListId: "list-b",
      order: 1,
      destinationOrderedIds: ["item-2", "item-1"],
      sourceOrderedIds: [],
      now,
    });

    expect(store.get(replicacheKeys.listItem("item-1"))).toMatchObject({
      listId: "list-b",
      order: 1,
    });
    expect(store.get(replicacheKeys.listItem("item-2"))).toMatchObject({
      listId: "list-b",
      order: 0,
    });
  });

  it("deletes a list and its dependent local keys", async () => {
    const { tx, store } = createTransaction({
      [replicacheKeys.list("list-1")]: { id: "list-1" },
      [replicacheKeys.listItem("item-1")]: {
        id: "item-1",
        listId: "list-1",
      },
      [replicacheKeys.listTag("list-1", "tag-1")]: {
        listId: "list-1",
        tagId: "tag-1",
      },
      [replicacheKeys.viewList("view-1", "list-1")]: {
        viewId: "view-1",
        listId: "list-1",
        order: 0,
      },
    });

    await replicacheMutators.deleteList(tx, { id: "list-1" });

    expect([...store.keys()]).toEqual([]);
  });

  it("rewrites integer list and item order", async () => {
    const now = "2026-06-14T12:00:00.000Z";
    const { tx, store } = createTransaction({
      [replicacheKeys.viewList("view-all", "list-a")]: {
        viewId: "view-all",
        listId: "list-a",
        order: 0,
      },
      [replicacheKeys.viewList("view-all", "list-b")]: {
        viewId: "view-all",
        listId: "list-b",
        order: 1,
      },
      [replicacheKeys.listItem("item-a")]: {
        id: "item-a",
        listId: "list-a",
        name: "A",
        order: 0,
        completed: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      [replicacheKeys.listItem("item-b")]: {
        id: "item-b",
        listId: "list-a",
        name: "B",
        order: 1,
        completed: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await replicacheMutators.reorderLists(tx, {
      viewId: "view-all",
      orderedIds: ["list-b", "list-a"],
    });
    await replicacheMutators.reorderItems(tx, {
      listId: "list-a",
      orderedIds: ["item-b", "item-a"],
    });

    expect(store.get(replicacheKeys.viewList("view-all", "list-b"))).toMatchObject({
      order: 0,
    });
    expect(store.get(replicacheKeys.viewList("view-all", "list-a"))).toMatchObject({
      order: 1,
    });
    expect(store.get(replicacheKeys.listItem("item-b"))).toMatchObject({
      order: 0,
    });
    expect(store.get(replicacheKeys.listItem("item-a"))).toMatchObject({
      order: 1,
    });
  });

  it("attaches and detaches list tags", async () => {
    const { tx, store } = createTransaction();

    await replicacheMutators.attachListTag(tx, {
      listId: "list-1",
      tagId: "tag-1",
    });
    expect(store.get(replicacheKeys.listTag("list-1", "tag-1"))).toEqual({
      listId: "list-1",
      tagId: "tag-1",
    });

    await replicacheMutators.detachListTag(tx, {
      listId: "list-1",
      tagId: "tag-1",
    });
    expect(store.has(replicacheKeys.listTag("list-1", "tag-1"))).toBe(false);
  });

  it("creates and updates a view and switches selected-view metadata", async () => {
    const now = "2026-06-14T12:00:00.000Z";
    const { tx, store } = createTransaction({
      [replicacheKeys.view("view-all")]: {
        id: "view-all",
        userId: "user-1",
        name: "All Lists",
        order: 0,
        type: "ALL_LISTS",
        isDefault: true,
        matchMode: "ALL",
        createdAt: now,
        updatedAt: now,
      },
    });

    await replicacheMutators.createView(tx, {
      id: "view-custom",
      userId: "user-1",
      name: "Work",
      order: 1,
      tagIds: ["tag-a"],
      matchMode: "ALL",
      now,
    });
    await replicacheMutators.updateView(tx, {
      id: "view-custom",
      name: "Work and Home",
      tagIds: ["tag-a", "tag-b"],
      matchMode: "ANY",
      now,
    });

    expect(store.get(replicacheKeys.view("view-custom"))).toMatchObject({
      name: "Work and Home",
      isDefault: true,
      matchMode: "ANY",
    });
    expect(store.has(replicacheKeys.viewTag("view-custom", "tag-a"))).toBe(true);
    expect(store.has(replicacheKeys.viewTag("view-custom", "tag-b"))).toBe(true);
    expect(store.get(replicacheKeys.selectedView)).toBe("view-custom");

    await replicacheMutators.setSelectedView(tx, { viewId: "view-all" });

    expect(store.get(replicacheKeys.selectedView)).toBe("view-all");
    expect(store.get(replicacheKeys.view("view-all"))).toMatchObject({
      isDefault: true,
    });
    expect(store.get(replicacheKeys.view("view-custom"))).toMatchObject({
      isDefault: false,
    });
  });
});

describe("Replicache server translation", () => {
  it("translates one cross-list move into FIFO move and reorder decisions", () => {
    const decisions = translateReplicacheMutation({
      userId: "user-1",
      clientID: "client-1",
      mutationID: 3,
      name: "moveItem",
      args: {
        id: "item-1",
        fromListId: "list-a",
        toListId: "list-b",
        order: 1,
        destinationOrderedIds: ["item-2", "item-1"],
        sourceOrderedIds: [],
        now: "2026-06-14T12:00:00.000Z",
      },
      timestamp: Date.parse("2026-06-14T12:00:00.000Z"),
    });

    expect(
      decisions.map((decision) =>
        decision.accepted
          ? [
              decision.operation.entityType,
              decision.operation.operationType,
              decision.operation.payload,
            ]
          : decision.errors
      ),
    ).toEqual([
      [
        "listItem",
        "move",
        { toListClientId: "list-b", order: 1 },
      ],
      [
        "listItem",
        "reorder",
        {
          listId: "list-b",
          orderedIds: ["item-2", "item-1"],
        },
      ],
      [
        "listItem",
        "reorder",
        {
          listId: "list-a",
          orderedIds: [],
        },
      ],
    ]);
  });
});
