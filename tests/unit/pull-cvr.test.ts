import { describe, expect, it } from "vitest";

import { buildReplicacheClientView } from "@/lib/sync/replicache/pull-cvr";
import { replicacheKeys } from "@/lib/sync/replicache/keys";

const timestamp = "2026-06-22T12:00:00.000Z";

const createList = () => ({
  id: "list-1",
  userId: "user-1",
  name: "List",
  workspaceId: null,
  accessRole: "OWNER" as const,
  createdAt: timestamp,
  updatedAt: timestamp,
  listItems: [],
  listTags: [],
});

const createView = () => ({
  id: "view-1",
  userId: "user-1",
  name: "View",
  orderKey: "a0",
  type: "CUSTOM" as const,
  isDefault: false,
  matchMode: "ALL" as const,
  createdAt: timestamp,
  updatedAt: timestamp,
  viewLists: [],
  viewTags: [],
});

const buildView = ({
  lists = [],
  views = [],
}: {
  lists?: object[];
  views?: object[];
} = {}) =>
  buildReplicacheClientView({
    allLists: { lists },
    views,
    tags: [],
  } as unknown as Parameters<typeof buildReplicacheClientView>[0]);

describe("buildReplicacheClientView", () => {
  it("tolerates an omitted listItems collection", () => {
    const list = createList();
    Reflect.deleteProperty(list, "listItems");

    expect(() => buildView({ lists: [list] })).not.toThrow();
    const result = buildView({ lists: [list] });

    expect(result[replicacheKeys.list(list.id)]).toBeDefined();
    expect(Object.keys(result)).toEqual([replicacheKeys.list(list.id)]);
  });

  it("tolerates an omitted listTags collection", () => {
    const list = createList();
    Reflect.deleteProperty(list, "listTags");

    expect(() => buildView({ lists: [list] })).not.toThrow();
    const result = buildView({ lists: [list] });

    expect(result[replicacheKeys.list(list.id)]).toBeDefined();
    expect(Object.keys(result)).toEqual([replicacheKeys.list(list.id)]);
  });

  it("preserves a list with an empty listItems collection", () => {
    const list = createList();
    const result = buildView({ lists: [list] });

    expect(result[replicacheKeys.list(list.id)]).toBeDefined();
    expect(Object.keys(result)).toEqual([replicacheKeys.list(list.id)]);
  });

  it("tolerates omitted viewLists and viewTags collections", () => {
    const view = createView();
    Reflect.deleteProperty(view, "viewLists");
    Reflect.deleteProperty(view, "viewTags");

    expect(() => buildView({ views: [view] })).not.toThrow();
    const result = buildView({ views: [view] });

    expect(result[replicacheKeys.view(view.id)]).toBeDefined();
    expect(Object.keys(result)).toEqual([replicacheKeys.view(view.id)]);
  });

  it("preserves populated listItems", () => {
    const list = {
      ...createList(),
      listItems: [{
        id: "item-1",
        name: "Item",
        completed: false,
        orderKey: "a0",
        notes: null,
        listId: "list-1",
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    };
    const result = buildView({ lists: [list] });

    expect(result[replicacheKeys.list(list.id)]).toBeDefined();
    expect(result[replicacheKeys.listItem(list.listItems[0].id)]).toBeDefined();
    expect(Object.keys(result)).toEqual([
      replicacheKeys.list(list.id),
      replicacheKeys.listItem(list.listItems[0].id),
    ]);
  });
});
