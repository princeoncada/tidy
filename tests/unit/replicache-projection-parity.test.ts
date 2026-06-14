import { describe, expect, it } from "vitest";

import {
  assembleReplicacheDashboard,
  type ReplicacheDashboardGraph,
} from "@/hooks/useReplicacheDashboard";
import { projectView } from "@/lib/dashboard/projection";

const now = "2026-06-14T12:00:00.000Z";

function graph(matchMode: "ALL" | "ANY"): ReplicacheDashboardGraph {
  return {
    lists: [
      { id: "list-b", userId: "user-1", name: "B", createdAt: now, updatedAt: now },
      { id: "list-a", userId: "user-1", name: "A", createdAt: now, updatedAt: now },
      { id: "untagged", userId: "user-1", name: "U", createdAt: now, updatedAt: now },
    ],
    listItems: [],
    tags: [
      { id: "tag-a", userId: "user-1", name: "A", color: "gray", createdAt: now, updatedAt: now },
      { id: "tag-b", userId: "user-1", name: "B", color: "blue", createdAt: now, updatedAt: now },
    ],
    views: [
      { id: "all", userId: "user-1", name: "All Lists", order: 0, type: "ALL_LISTS", isDefault: false, matchMode: "ALL", createdAt: now, updatedAt: now },
      { id: "custom", userId: "user-1", name: "Custom", order: 1, type: "CUSTOM", isDefault: true, matchMode, createdAt: now, updatedAt: now },
      { id: "untagged-view", userId: "user-1", name: "Untagged", order: 2, type: "UNTAGGED", isDefault: false, matchMode: "ALL", createdAt: now, updatedAt: now },
    ],
    viewLists: [
      { viewId: "all", listId: "list-a", order: 1 },
      { viewId: "all", listId: "list-b", order: 0 },
      { viewId: "all", listId: "untagged", order: 2 },
      { viewId: "custom", listId: "list-a", order: 5 },
      { viewId: "custom", listId: "list-b", order: 5 },
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
    source.viewLists = source.viewLists.map((viewList) =>
      viewList.viewId === "all"
        ? { ...viewList, order: viewList.listId === "untagged" ? 1 : 0 }
        : viewList
    );
    const dashboard = assembleReplicacheDashboard(source);

    expect(dashboard.allLists?.lists.map((list) => list.id)).toEqual([
      "list-a",
      "list-b",
      "untagged",
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
