import type {
  CurrentViewSnapshot,
  DashboardList,
  DashboardSnapshot,
  ViewCacheItem,
} from "@/lib/dashboard-cache";

export function listMatchesView(list: DashboardList, view: ViewCacheItem) {
  if (view.type === "ALL_LISTS") return true;

  if (view.type === "UNTAGGED") {
    return list.listTags.length === 0;
  }

  const requiredTagIds = view.viewTags.map((viewTag) => viewTag.tagId);
  if (requiredTagIds.length === 0) return false;

  const listTagIds = new Set(list.listTags.map((listTag) => listTag.tagId));
  if (view.matchMode === "ANY") {
    return requiredTagIds.some((tagId) => listTagIds.has(tagId));
  }

  return requiredTagIds.every((tagId) => listTagIds.has(tagId));
}

export function projectView(
  view: ViewCacheItem | undefined,
  allListsSnapshot: DashboardSnapshot | undefined,
): CurrentViewSnapshot | undefined {
  if (!view || !allListsSnapshot) return undefined;

  if (view.type === "ALL_LISTS") {
    return {
      ...allListsSnapshot,
      view,
    };
  }

  const viewListOrders = new Map(
    view.viewLists.map((viewList) => [viewList.listId, viewList.order]),
  );

  return {
    view,
    lists: allListsSnapshot.lists
      .filter((list) => listMatchesView(list, view))
      .map((list) => ({
        ...list,
        order: viewListOrders.get(list.id) ?? list.order,
      }))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  };
}

