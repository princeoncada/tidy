import { describe, expect, it } from "vitest";

import {
  assembleReplicacheDashboard,
  type ReplicacheDashboardGraph,
} from "@/hooks/useReplicacheDashboard";
import { projectView } from "@/lib/dashboard/projection";
import { initialKeys, keyBetween } from "@/lib/sync/fractional-index";

const now = "2026-06-14T12:00:00.000Z";

function graph(matchMode: "ALL" | "ANY"): ReplicacheDashboardGraph {
  const viewKeys = initialKeys(3);
  const allListKeys = initialKeys(3);
  const customListKeys = initialKeys(2);
  const itemKeys = initialKeys(2);

  return {
    lists: [
      { id: "list-b", userId: "user-1", name: "B", workspaceId: null, createdAt: now, updatedAt: now },
      { id: "list-a", userId: "user-1", name: "A", workspaceId: null, createdAt: now, updatedAt: now },
      { id: "untagged", userId: "user-1", name: "U", workspaceId: null, createdAt: now, updatedAt: now },
    ],
    listItems: [
      { id: "item-b", listId: "list-a", name: "B", order: itemKeys[1], completed: false, status: "IN_PROGRESS", assigneeId: "user-2", notes: null, createdAt: now, updatedAt: now },
      { id: "item-a", listId: "list-a", name: "A", order: itemKeys[0], completed: false, status: "TODO", assigneeId: null, notes: null, createdAt: now, updatedAt: now },
    ],
    tags: [
      { id: "tag-a", userId: "user-1", name: "A", color: "gray", createdAt: now, updatedAt: now },
      { id: "tag-b", userId: "user-1", name: "B", color: "blue", createdAt: now, updatedAt: now },
    ],
    views: [
      { id: "all", userId: "user-1", name: "All Lists", order: viewKeys[0], type: "ALL_LISTS", isDefault: false, matchMode: "ALL", createdAt: now, updatedAt: now },
      { id: "custom", userId: "user-1", name: "Custom", order: viewKeys[1], type: "CUSTOM", isDefault: true, matchMode, createdAt: now, updatedAt: now },
      { id: "untagged-view", userId: "user-1", name: "Untagged", order: viewKeys[2], type: "UNTAGGED", isDefault: false, matchMode: "ALL", createdAt: now, updatedAt: now },
    ],
    viewLists: [
      { viewId: "all", listId: "list-a", order: allListKeys[1] },
      { viewId: "all", listId: "list-b", order: allListKeys[0] },
      { viewId: "all", listId: "untagged", order: allListKeys[2] },
      { viewId: "custom", listId: "list-a", order: customListKeys[0] },
      { viewId: "custom", listId: "list-b", order: customListKeys[0] },
    ],
    viewTags: [
      { viewId: "custom", tagId: "tag-a" },
      { viewId: "custom", tagId: "tag-b" },
    ],
    listTags: [
      { listId: "list-a", tagId: "tag-a" },
      { listId: "list-a", tagId: "tag-b" },
      { listId: "list-b", tagId: "tag-a" },
    ],
    selectedViewId: "custom",
  };
}

describe("Replicache dashboard projection parity", () => {
  it("assembles ALL_LISTS using membership order and deterministic ties", () => {
    const source = graph("ALL");
    const [tieKey, afterTieKey] = initialKeys(2);
    source.viewLists = source.viewLists.map((viewList) =>
      viewList.viewId === "all"
        ? {
            ...viewList,
            order: viewList.listId === "untagged" ? afterTieKey : tieKey,
          }
        : viewList
    );
    const dashboard = assembleReplicacheDashboard(source);

    expect(dashboard.allLists?.lists.map((list) => list.id)).toEqual([
      "list-a",
      "list-b",
      "untagged",
    ]);
  });

  it("uses raw fractional-key ordering for a new top item", () => {
    const source = graph("ALL");
    const firstItemKey = source.listItems
      .find((item) => item.id === "item-a")?.order;
    if (!firstItemKey) throw new Error("Expected item-a order key.");

    source.listItems = [
      ...source.listItems,
      {
        id: "item-top",
        listId: "list-a",
        name: "Top",
        order: keyBetween(null, firstItemKey),
        completed: false,
        status: "DONE",
        assigneeId: "user-1",
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const dashboard = assembleReplicacheDashboard(source);

    expect(dashboard.allLists?.lists
      .find((list) => list.id === "list-a")
      ?.listItems.map((item) => item.id)).toEqual([
        "item-top",
        "item-a",
        "item-b",
      ]);
  });

  it.each(["ALL", "ANY"] as const)(
    "matches the shared server projection for CUSTOM %s and ordering",
    (matchMode) => {
      const dashboard = assembleReplicacheDashboard(graph(matchMode));
      const customView = dashboard.views.find((view) => view.id === "custom");

      expect(dashboard.currentView).toEqual(
        projectView(customView, dashboard.allLists),
      );
      expect(dashboard.currentView?.lists.map((list) => list.id)).toEqual(
        matchMode === "ALL" ? ["list-a"] : ["list-a", "list-b"],
      );
      expect(dashboard.allLists?.lists
        .find((list) => list.id === "list-a")
        ?.listItems.map((item) => item.id)).toEqual(["item-a", "item-b"]);
    },
  );

  it("projects UNTAGGED from the same local graph", () => {
    const dashboard = assembleReplicacheDashboard(graph("ALL"));
    const untagged = dashboard.views.find((view) => view.id === "untagged-view");

    expect(
      projectView(untagged, dashboard.allLists)?.lists.map((list) => list.id),
    ).toEqual(["untagged"]);
  });
});
