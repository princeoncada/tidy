import { describe, expect, it } from "vitest";

import { filterListsByWorkspace } from "@/lib/dashboard/workspace-filter";

const lists = [
  { id: "list-1", workspaceId: "workspace-1" },
  { id: "list-2", workspaceId: null },
  { id: "list-3", workspaceId: "workspace-1" },
  { id: "list-4", workspaceId: "workspace-2" },
];

describe("filterListsByWorkspace", () => {
  it("returns every list in the same order for all workspaces", () => {
    expect(filterListsByWorkspace(lists, null)).toEqual(lists);
  });

  it("returns only lists assigned to the active workspace", () => {
    expect(filterListsByWorkspace(lists, "workspace-1")).toEqual([
      lists[0],
      lists[2],
    ]);
  });

  it("returns an empty list when no workspace assignments match", () => {
    expect(filterListsByWorkspace(lists, "workspace-missing")).toEqual([]);
  });
});
