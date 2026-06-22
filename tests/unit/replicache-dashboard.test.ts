import { describe, expect, it } from "vitest";

import {
  assembleReplicacheDashboard,
  type ReplicacheDashboardGraph,
} from "@/hooks/useReplicacheDashboard";

const timestamp = "2026-06-22T12:00:00.000Z";

const allListsView = {
  id: "view-1",
  name: "All Lists",
  order: "a0",
  userId: "user-1",
  type: "ALL_LISTS" as const,
  isDefault: true,
  matchMode: "ALL" as const,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const createGraph = (
  overrides: Partial<ReplicacheDashboardGraph> = {},
): ReplicacheDashboardGraph => ({
  views: [allListsView],
  selectedViewId: allListsView.id,
  lists: [],
  listItems: [],
  tags: [],
  viewLists: [],
  viewTags: [],
  listTags: [],
  ...overrides,
});

describe("assembleReplicacheDashboard", () => {
  it("tolerates a partial list with an undefined id", () => {
    const lists = [{
      id: "list-1",
      userId: "user-1",
      name: "Complete List",
      workspaceId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, {
      id: undefined,
      userId: "user-1",
      name: "Partial List",
      workspaceId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }] as unknown as ReplicacheDashboardGraph["lists"];
    const graph = createGraph({ lists });

    expect(() => assembleReplicacheDashboard(graph)).not.toThrow();
    const result = assembleReplicacheDashboard(graph);

    expect(result.allLists).toBeDefined();
    expect(
      result.allLists?.lists.some((list) => list.id === "list-1"),
    ).toBe(true);
  });

  it("tolerates a partial view with an undefined id", () => {
    const views = [allListsView, {
      ...allListsView,
      id: undefined,
      name: "Partial View",
      type: "CUSTOM",
      isDefault: false,
    }] as unknown as ReplicacheDashboardGraph["views"];
    const graph = createGraph({ views });

    expect(() => assembleReplicacheDashboard(graph)).not.toThrow();
  });
});
