import {
  projectView,
  type DashboardSnapshot,
  type ViewCacheItem,
  type ViewsCache,
} from "@/lib/dashboard-cache";
import type {
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "@/lib/local-db/local-schema";

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

function localEntityId(entity: { clientId: string; serverId: string | null }) {
  return entity.serverId ?? entity.clientId;
}

function relationshipId(...ids: string[]) {
  return ids.join("::");
}

function compareByOrderAndId(
  left: { order: number; id: string },
  right: { order: number; id: string },
) {
  return left.order - right.order || left.id.localeCompare(right.id);
}

type LocalDashboardGraph = {
  lists: LocalList[];
  listItems: LocalListItem[];
  tags: LocalTag[];
  listTags: LocalListTag[];
};

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

export function mapLocalViewToViewCacheItem(
  view: LocalView,
  localViewTags: LocalViewTag[] = [],
  localViewLists: LocalViewList[] = [],
  localTags: LocalTag[] = [],
): ViewCacheItem {
  const viewId = localEntityId(view);
  const tagByClientId = new Map(localTags.map((tag) => [tag.clientId, tag]));

  return {
    id: viewId,
    name: view.name,
    userId: view.userId,
    order: view.order,
    type: view.type,
    isDefault: view.isDefault,
    matchMode: view.matchMode,
    createdAt: toDate(view.createdAt),
    updatedAt: toDate(view.updatedAt),
    viewTags: localViewTags
      .filter((viewTag) => viewTag.viewClientId === view.clientId)
      .flatMap((viewTag) => {
        const tag = tagByClientId.get(viewTag.tagClientId);
        if (!tag) return [];

        const tagId = localEntityId(tag);
        return [{
          viewId,
          tagId,
          tag: {
            id: tagId,
            name: tag.name,
            color: tag.color,
            userId: tag.userId,
            createdAt: toDate(tag.createdAt),
            updatedAt: toDate(tag.updatedAt),
          },
        }];
      })
      .sort((left, right) => left.tagId.localeCompare(right.tagId)),
    viewLists: localViewLists
      .filter((viewList) => viewList.viewClientId === view.clientId)
      .map((viewList) => ({
        listId: viewList.listServerId ?? viewList.listClientId,
        order: viewList.order,
      }))
      .sort((left, right) =>
        left.order - right.order || left.listId.localeCompare(right.listId)
      ),
  };
}

export function mapLocalListToDashboardList(
  list: LocalList,
  order: number,
  localItems: LocalListItem[],
  localListTags: LocalListTag[],
  localTags: LocalTag[],
): DashboardSnapshot["lists"][number] {
  const listId = localEntityId(list);
  const tagByClientId = new Map(localTags.map((tag) => [tag.clientId, tag]));

  return {
    id: listId,
    userId: list.userId,
    name: list.name,
    order,
    createdAt: toDate(list.createdAt),
    updatedAt: toDate(list.updatedAt),
    listTags: localListTags
      .filter((listTag) => listTag.listClientId === list.clientId)
      .flatMap((listTag) => {
        const tag = tagByClientId.get(listTag.tagClientId);
        if (!tag) return [];

        const tagId = localEntityId(tag);
        return [{
          listId,
          tagId,
          tag: {
            id: tagId,
            name: tag.name,
            color: tag.color,
            userId: tag.userId,
            createdAt: toDate(tag.createdAt),
            updatedAt: toDate(tag.updatedAt),
          },
        }];
      })
      .sort((left, right) => left.tagId.localeCompare(right.tagId)),
    listItems: localItems
      .filter((item) => item.listClientId === list.clientId)
      .map((item) => ({
        id: localEntityId(item),
        name: item.name,
        completed: item.completed,
        order: item.order,
        notes: item.notes,
        listId,
        createdAt: toDate(item.createdAt),
        updatedAt: toDate(item.updatedAt),
      }))
      .sort(compareByOrderAndId),
  };
}

export function buildLocalDashboardSnapshot(
  view: ViewCacheItem,
  graph: LocalDashboardGraph,
): DashboardSnapshot {
  const viewListOrderByListId = new Map(
    view.viewLists.map((viewList) => [viewList.listId, viewList.order]),
  );
  const orderedLocalLists = [...graph.lists].sort((left, right) => {
    const leftId = localEntityId(left);
    const rightId = localEntityId(right);
    const leftOrder = viewListOrderByListId.get(leftId);
    const rightOrder = viewListOrderByListId.get(rightId);

    if (leftOrder !== undefined || rightOrder !== undefined) {
      if (leftOrder === undefined) return 1;
      if (rightOrder === undefined) return -1;
      return leftOrder - rightOrder || leftId.localeCompare(rightId);
    }

    return right.createdAt.localeCompare(left.createdAt) ||
      leftId.localeCompare(rightId);
  });
  const allListsSnapshot: DashboardSnapshot = {
    view,
    lists: orderedLocalLists.map((list, index) =>
      mapLocalListToDashboardList(
        list,
        viewListOrderByListId.get(localEntityId(list)) ?? index,
        graph.listItems,
        graph.listTags,
        graph.tags,
      )
    ),
  };

  return projectView(view, allListsSnapshot) ?? allListsSnapshot;
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

export function mapServerSnapshotToLocalListItems(
  snapshot: DashboardSnapshot,
  userId: string,
): LocalListItem[] {
  return snapshot.lists.flatMap((list) =>
    list.listItems.map((item) => {
      const createdAt = toIso(item.createdAt);
      const updatedAt = toIso(item.updatedAt);

      return {
        ...localEntityBase({
          clientId: item.id,
          serverId: item.id,
          userId,
          createdAt,
          updatedAt,
          lastSyncedAt: updatedAt,
        }),
        name: item.name,
        completed: item.completed,
        order: item.order,
        notes: item.notes,
        listClientId: list.id,
        listServerId: list.id,
      };
    })
  );
}

export function mapServerGraphToLocalTags(
  serverViews: ViewsCache,
  snapshot: DashboardSnapshot,
  userId: string,
): LocalTag[] {
  const serverTags = [
    ...serverViews.flatMap((view) => view.viewTags.map((viewTag) => viewTag.tag)),
    ...snapshot.lists.flatMap((list) => list.listTags.map((listTag) => listTag.tag)),
  ];
  const tagById = new Map(serverTags.map((tag) => [tag.id, tag]));

  return [...tagById.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((tag) => {
      const createdAt = toIso(tag.createdAt);
      const updatedAt = toIso(tag.updatedAt);

      return {
        ...localEntityBase({
          clientId: tag.id,
          serverId: tag.id,
          userId,
          createdAt,
          updatedAt,
          lastSyncedAt: updatedAt,
        }),
        name: tag.name,
        color: tag.color,
      };
    });
}

export function mapServerSnapshotToLocalListTags(
  snapshot: DashboardSnapshot,
  userId: string,
): LocalListTag[] {
  return snapshot.lists.flatMap((list) => {
    const createdAt = toIso(list.createdAt);
    const updatedAt = toIso(list.updatedAt);

    return list.listTags.map((listTag) => {
      const id = relationshipId(list.id, listTag.tagId);

      return {
        ...localEntityBase({
          clientId: id,
          serverId: id,
          userId,
          createdAt,
          updatedAt,
          lastSyncedAt: updatedAt,
        }),
        listClientId: list.id,
        listServerId: list.id,
        tagClientId: listTag.tagId,
        tagServerId: listTag.tagId,
      };
    });
  });
}

export function mapServerViewsToLocalViewLists(
  serverViews: ViewsCache,
  userId: string,
): LocalViewList[] {
  return serverViews.flatMap((view) => {
    const createdAt = toIso(view.createdAt);
    const updatedAt = toIso(view.updatedAt);

    return view.viewLists.map((viewList) => {
      const id = relationshipId(view.id, viewList.listId);

      return {
        ...localEntityBase({
          clientId: id,
          serverId: id,
          userId,
          createdAt,
          updatedAt,
          lastSyncedAt: updatedAt,
        }),
        viewClientId: view.id,
        viewServerId: view.id,
        listClientId: viewList.listId,
        listServerId: viewList.listId,
        order: viewList.order,
      };
    });
  });
}

export function mapServerViewsToLocalViewTags(
  serverViews: ViewsCache,
  userId: string,
): LocalViewTag[] {
  return serverViews.flatMap((view) => {
    const createdAt = toIso(view.createdAt);
    const updatedAt = toIso(view.updatedAt);

    return view.viewTags.map((viewTag) => {
      const id = relationshipId(view.id, viewTag.tagId);

      return {
        ...localEntityBase({
          clientId: id,
          serverId: id,
          userId,
          createdAt,
          updatedAt,
          lastSyncedAt: updatedAt,
        }),
        viewClientId: view.id,
        viewServerId: view.id,
        tagClientId: viewTag.tagId,
        tagServerId: viewTag.tagId,
      };
    });
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
