import { describe, expect, it } from "vitest";

import { listMatchesView, projectView, selectedViewFromCache } from "@/lib/dashboard-cache";

const tag = (id: string, name = id) => ({
  id,
  name,
  color: "gray" as const,
  userId: "user-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  listTags: [],
});

const list = (id: string, tagIds: string[] = [], order = 0) => ({
  id,
  userId: "user-1",
  name: id,
  order,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  listItems: [],
  listTags: tagIds.map((tagId) => ({
    listId: id,
    tagId,
    tag: tag(tagId),
  })),
});

const view = (overrides = {}) => ({
  id: "view-1",
  name: "View",
  userId: "user-1",
  order: 0,
  type: "CUSTOM" as const,
  isDefault: false,
  matchMode: "ALL" as const,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  viewTags: [
    { viewId: "view-1", tagId: "a", tag: tag("a") },
    { viewId: "view-1", tagId: "b", tag: tag("b") },
  ],
  viewLists: [],
  ...overrides,
});

describe("dashboard cache projection", () => {
  it("ALL custom matching requires all view tags", () => {
    const customView = view();

    expect(listMatchesView(list("match", ["a", "b"]), customView)).toBe(true);
    expect(listMatchesView(list("missing-one", ["a"]), customView)).toBe(false);
    expect(listMatchesView(list("missing-all", []), customView)).toBe(false);
  });

  it("custom views with no required tags match no lists", () => {
    expect(listMatchesView(list("untagged"), view({ viewTags: [] }))).toBe(false);
  });

  it("projects all lists without filtering", () => {
    const allListsView = view({ type: "ALL_LISTS" as const, viewTags: [] });
    const snapshot = { view: allListsView, lists: [list("a"), list("b")] };

    expect(projectView(allListsView, snapshot)?.lists.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("projects custom views by filtering and view order", () => {
    const customView = view({
      viewLists: [
        { listId: "second", order: 0 },
        { listId: "first", order: 1 },
      ],
    });
    const snapshot = {
      view: view({ type: "ALL_LISTS" as const, viewTags: [] }),
      lists: [
        list("first", ["a", "b"], 10),
        list("hidden", ["a"], 0),
        list("second", ["a", "b"], 20),
      ],
    };

    expect(projectView(customView, snapshot)?.lists.map((entry) => entry.id)).toEqual(["second", "first"]);
  });

  it("selects the default view before falling back to All Lists", () => {
    const allListsView = view({ id: "all", type: "ALL_LISTS" as const });
    const defaultView = view({ id: "default", isDefault: true });

    expect(selectedViewFromCache([allListsView, defaultView])?.id).toBe("default");
    expect(selectedViewFromCache([allListsView])?.id).toBe("all");
  });
});
