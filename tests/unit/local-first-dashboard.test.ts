import { describe, expect, it } from "vitest";

import { isLatestSelectedView, type DashboardSnapshot, type ViewCacheItem } from "@/lib/dashboard-cache";
import {
  buildLocalDashboardSnapshot,
  LOCAL_ALL_LISTS_VIEW_ID,
  mapLocalListToDashboardList,
  mapLocalViewToViewCacheItem,
  mapServerSnapshotToLocalLists,
  mapServerViewsToLocalViews,
  resolveDashboardCurrentView,
  synthesizeAllListsView,
} from "@/lib/local-first-dashboard";
import type { LocalList, LocalView } from "@/lib/local-db/local-schema";

const createdAt = "2026-06-08T10:00:00.000Z";
const updatedAt = "2026-06-08T10:01:00.000Z";

function localList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    clientId: "local-list-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    name: "Inbox",
    ...overrides,
  };
}

function localView(overrides: Partial<LocalView> = {}): LocalView {
  return {
    clientId: "local-view-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    name: "All Lists",
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    ...overrides,
  };
}

function viewCache(overrides: Partial<ViewCacheItem> = {}): ViewCacheItem {
  return {
    id: "view-1",
    name: "All Lists",
    userId: "user-1",
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    viewTags: [],
    viewLists: [],
    ...overrides,
  };
}

function dashboardSnapshot(view: ViewCacheItem, listName = "Inbox"): DashboardSnapshot {
  return {
    view,
    lists: [
      {
        id: "list-1",
        userId: "user-1",
        name: listName,
        order: 0,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        listTags: [],
        listItems: [],
      },
    ],
  };
}

describe("local-first dashboard mappers", () => {
  it("synthesizes a stable All Lists view", () => {
    expect(synthesizeAllListsView("user-1")).toMatchObject({
      id: LOCAL_ALL_LISTS_VIEW_ID,
      userId: "user-1",
      name: "All Lists",
      type: "ALL_LISTS",
      isDefault: true,
      matchMode: "ALL",
      order: 0,
      viewTags: [],
      viewLists: [],
    });
  });

  it("maps local views with server id preferred and empty membership", () => {
    expect(
      mapLocalViewToViewCacheItem(localView({ serverId: "server-view-1" })),
    ).toMatchObject({
      id: "server-view-1",
      type: "ALL_LISTS",
      viewTags: [],
      viewLists: [],
    });
  });

  it("maps local lists to empty dashboard lists with index order and server id preferred", () => {
    expect(
      mapLocalListToDashboardList(localList({ serverId: "server-list-1" }), 3),
    ).toMatchObject({
      id: "server-list-1",
      userId: "user-1",
      name: "Inbox",
      order: 3,
      listTags: [],
      listItems: [],
    });
  });

  it("builds a local dashboard snapshot whose view passes the selected-view guard", () => {
    const view = synthesizeAllListsView("user-1");
    const snapshot = buildLocalDashboardSnapshot(view, [localList()]);

    expect(isLatestSelectedView(view.id, snapshot.view.id)).toBe(true);
    expect(snapshot.lists).toHaveLength(1);
  });

  it("maps server views and snapshots back into synced local rows", () => {
    const view = viewCache({ id: "server-view-1" });
    const snapshot = dashboardSnapshot(view);

    expect(mapServerViewsToLocalViews([view], "user-1")).toEqual([
      expect.objectContaining({
        clientId: "server-view-1",
        serverId: "server-view-1",
        syncStatus: "synced",
        lastSyncedAt: updatedAt,
      }),
    ]);
    expect(mapServerSnapshotToLocalLists(snapshot, "user-1")).toEqual([
      expect.objectContaining({
        clientId: "list-1",
        serverId: "list-1",
        syncStatus: "synced",
        name: "Inbox",
      }),
    ]);
  });

  it("prefers server data, falls back to local, then holds the last good view", () => {
    const localView = viewCache({ id: LOCAL_ALL_LISTS_VIEW_ID });
    const serverView = viewCache({ id: "server-view-1" });
    const localSnapshot = dashboardSnapshot(localView, "Local");
    const serverSnapshot = dashboardSnapshot(serverView, "Server");

    expect(
      resolveDashboardCurrentView({
        selectedViewId: LOCAL_ALL_LISTS_VIEW_ID,
        selectedViewSnapshot: undefined,
        bootCurrentView: undefined,
        localCurrentView: localSnapshot,
        previousCurrentView: undefined,
      })?.lists[0].name,
    ).toBe("Local");

    expect(
      resolveDashboardCurrentView({
        selectedViewId: "server-view-1",
        selectedViewSnapshot: serverSnapshot,
        bootCurrentView: undefined,
        localCurrentView: localSnapshot,
        previousCurrentView: undefined,
      })?.lists[0].name,
    ).toBe("Server");

    expect(
      resolveDashboardCurrentView({
        selectedViewId: "server-view-1",
        selectedViewSnapshot: undefined,
        bootCurrentView: undefined,
        localCurrentView: localSnapshot,
        previousCurrentView: localSnapshot,
      })?.lists[0].name,
    ).toBe("Local");
  });
});
