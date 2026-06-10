import { describe, expect, it } from "vitest";

import type {
  DashboardSnapshot,
  ViewCacheItem,
  ViewsCache,
} from "@/lib/dashboard-cache";
import { reconcileServerGraphIntoLocalPlan } from "@/lib/local-first-reconcile";
import type { LocalList } from "@/lib/local-db/local-schema";

const createdAt = "2026-06-10T10:00:00.000Z";
const updatedAt = "2026-06-10T10:01:00.000Z";

function serverView(listIds: string[]): ViewCacheItem {
  return {
    id: "view-all",
    name: "All Lists",
    userId: "user-1",
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    viewTags: [],
    viewLists: listIds.map((listId, order) => ({ listId, order })),
  };
}

function serverGraph(listIds = ["server-list-a", "server-list-b"]): {
  views: ViewsCache;
  allLists: DashboardSnapshot;
} {
  const view = serverView(listIds);

  return {
    views: [view],
    allLists: {
      view,
      lists: listIds.map((id, order) => ({
        id,
        userId: "user-1",
        name: id,
        order,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        listTags: [],
        listItems: [],
      })),
    },
  };
}

function localList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    clientId: "local-list",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    name: "Local",
    ...overrides,
  };
}

function emptyLocalGraph() {
  return {
    views: [],
    lists: [],
    listItems: [],
    tags: [],
    listTags: [],
    viewLists: [],
    viewTags: [],
  };
}

describe("reconcileServerGraphIntoLocalPlan", () => {
  it("deduplicates by server id first, then by acknowledged client id", () => {
    const plan = reconcileServerGraphIntoLocalPlan({
      userId: "user-1",
      server: serverGraph(),
      local: {
        ...emptyLocalGraph(),
        lists: [
          localList({
            clientId: "preserved-client-a",
            serverId: "server-list-a",
            syncStatus: "synced",
          }),
          localList({
            clientId: "server-list-a",
            syncStatus: "synced",
          }),
          localList({
            clientId: "server-list-b",
            syncStatus: "pending",
          }),
        ],
      },
    });

    expect(plan.lists.upserts).toEqual([
      expect.objectContaining({
        clientId: "preserved-client-a",
        serverId: "server-list-a",
        syncStatus: "synced",
      }),
      expect.objectContaining({
        clientId: "server-list-b",
        serverId: "server-list-b",
        syncStatus: "synced",
      }),
    ]);
    expect(new Set(plan.lists.upserts.map((list) => list.clientId)).size).toBe(2);
    expect(plan.lists.deleteClientIds).toEqual(["server-list-a"]);
    expect(plan.viewLists.upserts).toEqual([
      expect.objectContaining({
        viewClientId: "view-all",
        listClientId: "preserved-client-a",
      }),
      expect.objectContaining({
        viewClientId: "view-all",
        listClientId: "server-list-b",
      }),
    ]);
  });

  it("keeps unmatched pending, local, syncing, and failed rows untouched", () => {
    const pendingRows = [
      localList({ clientId: "local", syncStatus: "local" }),
      localList({ clientId: "pending", syncStatus: "pending" }),
      localList({ clientId: "syncing", syncStatus: "syncing" }),
      localList({ clientId: "failed", syncStatus: "failed" }),
    ];
    const plan = reconcileServerGraphIntoLocalPlan({
      userId: "user-1",
      server: serverGraph([]),
      local: {
        ...emptyLocalGraph(),
        lists: pendingRows,
      },
    });

    expect(plan.lists.upserts).toEqual([]);
    expect(plan.lists.deleteClientIds).toEqual([]);
  });

  it("deletes stale synced rows missing from the server collection", () => {
    const plan = reconcileServerGraphIntoLocalPlan({
      userId: "user-1",
      server: serverGraph(["server-list-a"]),
      local: {
        ...emptyLocalGraph(),
        lists: [
          localList({
            clientId: "active-client",
            serverId: "server-list-a",
            syncStatus: "synced",
          }),
          localList({
            clientId: "stale-client",
            serverId: "server-list-stale",
            syncStatus: "synced",
          }),
        ],
      },
    });

    expect(plan.lists.deleteClientIds).toEqual(["stale-client"]);
  });

  it("returns the same ordered plan for identical graph content", () => {
    const server = serverGraph();
    const localLists = [
      localList({
        clientId: "client-b",
        serverId: "server-list-b",
        syncStatus: "synced",
      }),
      localList({
        clientId: "client-a",
        serverId: "server-list-a",
        syncStatus: "synced",
      }),
      localList({
        clientId: "stale",
        serverId: "server-list-stale",
        syncStatus: "synced",
      }),
    ];
    const forward = reconcileServerGraphIntoLocalPlan({
      userId: "user-1",
      server,
      local: {
        ...emptyLocalGraph(),
        lists: localLists,
      },
    });
    const reversed = reconcileServerGraphIntoLocalPlan({
      userId: "user-1",
      server: {
        views: [...server.views].reverse(),
        allLists: {
          ...server.allLists,
          lists: [...server.allLists.lists].reverse(),
        },
      },
      local: {
        ...emptyLocalGraph(),
        lists: [...localLists].reverse(),
      },
    });

    expect(reversed).toEqual(forward);
  });
});
