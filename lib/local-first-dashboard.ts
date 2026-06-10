import type { DashboardSnapshot, ViewCacheItem, ViewsCache } from "@/lib/dashboard-cache";
import type { LocalList, LocalView } from "@/lib/local-db/local-schema";

export const LOCAL_ALL_LISTS_VIEW_ID = "local-all-lists-view";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function localEntityBase(args: {
  clientId: string;
  serverId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string;
}) {
  return {
    clientId: args.clientId,
    serverId: args.serverId,
    userId: args.userId,
    syncStatus: "synced" as const,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
    deletedAt: null,
    lastSyncedAt: args.lastSyncedAt,
  };
}

export function synthesizeAllListsView(userId: string): ViewCacheItem {
  const now = new Date(0);

  return {
    id: LOCAL_ALL_LISTS_VIEW_ID,
    name: "All Lists",
    userId,
    order: 0,
    type: "ALL_LISTS",
    isDefault: true,
    matchMode: "ALL",
    createdAt: now,
    updatedAt: now,
    viewTags: [],
    viewLists: [],
  };
}

export function mapLocalViewToViewCacheItem(view: LocalView): ViewCacheItem {
  return {
    id: view.serverId ?? view.clientId,
    name: view.name,
    userId: view.userId,
    order: view.order,
    type: view.type,
    isDefault: view.isDefault,
    matchMode: view.matchMode,
    createdAt: toDate(view.createdAt),
    updatedAt: toDate(view.updatedAt),
    viewTags: [],
    viewLists: [],
  };
}

export function mapLocalListToDashboardList(
  list: LocalList,
  order: number,
): DashboardSnapshot["lists"][number] {
  return {
    id: list.serverId ?? list.clientId,
    userId: list.userId,
    name: list.name,
    order,
    createdAt: toDate(list.createdAt),
    updatedAt: toDate(list.updatedAt),
    listTags: [],
    listItems: [],
  };
}

export function buildLocalDashboardSnapshot(
  view: ViewCacheItem,
  localLists: LocalList[],
): DashboardSnapshot {
  return {
    view,
    lists: localLists.map((list, index) => mapLocalListToDashboardList(list, index)),
  };
}

export function mapServerViewsToLocalViews(
  serverViews: ViewsCache,
  userId: string,
): LocalView[] {
  return serverViews.map((view) => {
    const createdAt = toIso(view.createdAt);
    const updatedAt = toIso(view.updatedAt);

    return {
      ...localEntityBase({
        clientId: view.id,
        serverId: view.id,
        userId,
        createdAt,
        updatedAt,
        lastSyncedAt: updatedAt,
      }),
      name: view.name,
      order: view.order,
      type: view.type,
      isDefault: view.isDefault,
      matchMode: view.matchMode,
    };
  });
}

export function mapServerSnapshotToLocalLists(
  snapshot: DashboardSnapshot,
  userId: string,
): LocalList[] {
  return snapshot.lists.map((list) => {
    const createdAt = toIso(list.createdAt);
    const updatedAt = toIso(list.updatedAt);

    return {
      ...localEntityBase({
        clientId: list.id,
        serverId: list.id,
        userId,
        createdAt,
        updatedAt,
        lastSyncedAt: updatedAt,
      }),
      name: list.name,
    };
  });
}

export function resolveDashboardCurrentView(args: {
  selectedViewId: string | null | undefined;
  selectedViewSnapshot: DashboardSnapshot | undefined;
  bootCurrentView: DashboardSnapshot | undefined;
  localCurrentView: DashboardSnapshot | undefined;
  previousCurrentView: DashboardSnapshot | undefined;
}): DashboardSnapshot | undefined {
  const matchesSelectedView = (snapshot: DashboardSnapshot | undefined) =>
    Boolean(args.selectedViewId && snapshot?.view.id === args.selectedViewId);

  return (matchesSelectedView(args.selectedViewSnapshot)
    ? args.selectedViewSnapshot
    : undefined) ??
    (matchesSelectedView(args.bootCurrentView)
      ? args.bootCurrentView
      : undefined) ??
    (matchesSelectedView(args.localCurrentView)
      ? args.localCurrentView
      : undefined) ??
    args.previousCurrentView;
}
