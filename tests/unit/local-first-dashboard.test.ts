import { describe, expect, it } from "vitest";

import {
  isLatestSelectedView,
  type DashboardSnapshot,
  type ViewCacheItem,
} from "@/lib/dashboard-cache";
import {
  buildLocalDashboardSnapshot,
  LOCAL_ALL_LISTS_VIEW_ID,
  mapLocalListToDashboardList,
  mapLocalViewToViewCacheItem,
  mapServerGraphToLocalTags,
  mapServerSnapshotToLocalListItems,
  mapServerSnapshotToLocalLists,
  mapServerSnapshotToLocalListTags,
  mapServerViewsToLocalViewLists,
  mapServerViewsToLocalViews,
  mapServerViewsToLocalViewTags,
  resolveDashboardCurrentView,
  synthesizeAllListsView,
} from "@/lib/local-first-dashboard";
import type {
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "@/lib/local-db/local-schema";

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

function localItem(overrides: Partial<LocalListItem> = {}): LocalListItem {
  return {
    clientId: "local-item-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    name: "First item",
    completed: false,
    order: 0,
    notes: null,
    listClientId: "local-list-1",
    listServerId: null,
    ...overrides,
  };
}

function localTag(overrides: Partial<LocalTag> = {}): LocalTag {
  return {
    clientId: "local-tag-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    name: "Focus",
    color: "blue",
    ...overrides,
  };
}

function localListTag(overrides: Partial<LocalListTag> = {}): LocalListTag {
  return {
    clientId: "local-list-1::local-tag-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    listClientId: "local-list-1",
    listServerId: null,
    tagClientId: "local-tag-1",
    tagServerId: null,
    ...overrides,
  };
}

function localViewTag(overrides: Partial<LocalViewTag> = {}): LocalViewTag {
  return {
    clientId: "local-view-1::local-tag-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    viewClientId: "local-view-1",
    viewServerId: null,
    tagClientId: "local-tag-1",
    tagServerId: null,
    ...overrides,
  };
}

function localViewList(overrides: Partial<LocalViewList> = {}): LocalViewList {
  return {
    clientId: "local-view-1::local-list-1",
    serverId: null,
    userId: "user-1",
    syncStatus: "local",
    createdAt,
    updatedAt,
    deletedAt: null,
    lastSyncedAt: null,
    viewClientId: "local-view-1",
    viewServerId: null,
    listClientId: "local-list-1",
    listServerId: null,
    order: 0,
    ...overrides,
  };
}

const serverTag = {
  id: "server-tag-1",
  name: "Focus",
  color: "blue" as const,
  userId: "user-1",
  createdAt: new Date(createdAt),
  updatedAt: new Date(updatedAt),
};

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
        order: 4,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        listTags: [
          {
            listId: "list-1",
            tagId: serverTag.id,
            tag: serverTag,
          },
        ],
        listItems: [
          {
            id: "item-1",
            name: "First item",
            completed: false,
            order: 0,
            notes: null,
            listId: "list-1",
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        ],
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

  it("maps local views with complete tag and membership relationships", () => {
    expect(
      mapLocalViewToViewCacheItem(
        localView({ serverId: "server-view-1" }),
        [localViewTag()],
        [localViewList({ order: 7 })],
        [localTag({ serverId: "server-tag-1" })],
      ),
    ).toMatchObject({
      id: "server-view-1",
      type: "ALL_LISTS",
      viewTags: [{ viewId: "server-view-1", tagId: "server-tag-1" }],
      viewLists: [{ listId: "local-list-1", order: 7 }],
    });
  });

  it("maps local lists with ordered items and resolved list tags", () => {
    expect(
      mapLocalListToDashboardList(
        localList({ serverId: "server-list-1" }),
        3,
        [
          localItem({ clientId: "item-b", order: 1 }),
          localItem({ clientId: "item-a", order: 0 }),
        ],
        [localListTag()],
        [localTag({ serverId: "server-tag-1" })],
      ),
    ).toMatchObject({
      id: "server-list-1",
      userId: "user-1",
      name: "Inbox",
      order: 3,
      listTags: [{ listId: "server-list-1", tagId: "server-tag-1" }],
      listItems: [
        { id: "item-a", listId: "server-list-1", order: 0 },
        { id: "item-b", listId: "server-list-1", order: 1 },
      ],
    });
  });

  it("builds a complete custom snapshot with tag membership and view order", () => {
    const customView = mapLocalViewToViewCacheItem(
      localView({
        name: "Focus",
        type: "CUSTOM",
        matchMode: "ALL",
      }),
      [localViewTag()],
      [
        localViewList({
          listClientId: "matching-b",
          clientId: "local-view-1::matching-b",
          order: 0,
        }),
        localViewList({
          listClientId: "matching-a",
          clientId: "local-view-1::matching-a",
          order: 1,
        }),
      ],
      [localTag()],
    );
    const snapshot = buildLocalDashboardSnapshot(customView, {
      lists: [
        localList({ clientId: "matching-a", name: "Matching A" }),
        localList({ clientId: "hidden", name: "Hidden" }),
        localList({ clientId: "matching-b", name: "Matching B" }),
      ],
      listItems: [
        localItem({
          clientId: "item-b",
          listClientId: "matching-b",
          name: "Visible item",
        }),
      ],
      tags: [localTag()],
      listTags: [
        localListTag({
          clientId: "matching-a::local-tag-1",
          listClientId: "matching-a",
        }),
        localListTag({
          clientId: "matching-b::local-tag-1",
          listClientId: "matching-b",
        }),
      ],
    });

    expect(isLatestSelectedView(customView.id, snapshot.view.id)).toBe(true);
    expect(snapshot.lists.map((list) => list.id)).toEqual([
      "matching-b",
      "matching-a",
    ]);
    expect(snapshot.lists[0]).toMatchObject({
      order: 0,
      listItems: [{ id: "item-b", name: "Visible item" }],
      listTags: [{ tagId: "local-tag-1" }],
    });
  });

  it("maps the complete server graph back into synced local rows", () => {
    const allListsView = viewCache({
      id: "server-view-1",
      viewTags: [
        {
          viewId: "server-view-1",
          tagId: serverTag.id,
          tag: serverTag,
        },
      ],
      viewLists: [{ listId: "list-1", order: 4 }],
    });
    const snapshot = dashboardSnapshot(allListsView);

    expect(mapServerViewsToLocalViews([allListsView], "user-1")).toEqual([
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
    expect(mapServerSnapshotToLocalListItems(snapshot, "user-1")).toEqual([
      expect.objectContaining({
        clientId: "item-1",
        listClientId: "list-1",
        order: 0,
      }),
    ]);
    expect(mapServerGraphToLocalTags([allListsView], snapshot, "user-1")).toEqual([
      expect.objectContaining({
        clientId: "server-tag-1",
        name: "Focus",
      }),
    ]);
    expect(mapServerSnapshotToLocalListTags(snapshot, "user-1")).toEqual([
      expect.objectContaining({
        clientId: "list-1::server-tag-1",
        listClientId: "list-1",
        tagClientId: "server-tag-1",
      }),
    ]);
    expect(mapServerViewsToLocalViewLists([allListsView], "user-1")).toEqual([
      expect.objectContaining({
        clientId: "server-view-1::list-1",
        order: 4,
      }),
    ]);
    expect(mapServerViewsToLocalViewTags([allListsView], "user-1")).toEqual([
      expect.objectContaining({
        clientId: "server-view-1::server-tag-1",
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
