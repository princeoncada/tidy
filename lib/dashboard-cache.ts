import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { RouterOutputs } from "@/lib/trpc";

export type ViewsCache = RouterOutputs["view"]["getAll"];
export type ViewCacheItem = ViewsCache[number];
export type CurrentViewSnapshot = RouterOutputs["view"]["getCurrentViewListsWithItems"];
export type DashboardSnapshot = CurrentViewSnapshot
export type DashboardList = DashboardSnapshot["lists"][number];
type DashboardListItem = DashboardList["listItems"][number];
type CreatedListPayload = Omit<DashboardList, "order" | "listItems" | "listTags"> &
  Partial<Pick<DashboardList, "order" | "listItems" | "listTags">>;
export type DashboardTag = RouterOutputs["tag"]["getAll"][number];
export type SavedListTags = DashboardList["listTags"];
export type AffectedTagView =
  RouterOutputs["tag"]["addToList"]["affectedViews"][number] |
  RouterOutputs["tag"]["removeFromList"]["affectedViews"][number] |
  RouterOutputs["tag"]["applyListTagChanges"]["affectedViews"][number] |
  RouterOutputs["tag"]["delete"]["affectedViews"][number];

export type DashboardKeys = {
  views: QueryKey;
  allLists: QueryKey;
  currentView: QueryKey;
  selectedView: QueryKey;
};

export type DashboardKeySource = {
  view: {
    getAll: { queryKey: () => QueryKey };
    getCurrentViewListsWithItems: { queryKey: () => QueryKey };
    getViewListsWithItems: { queryKey: (input: { viewId: string }) => QueryKey };
  };
};

export function buildDashboardKeys(
  source: DashboardKeySource,
  ids: { allListsViewId?: string; selectedViewId?: string }
): DashboardKeys {
  const views = source.view.getAll.queryKey();
  const currentView = source.view.getCurrentViewListsWithItems.queryKey();
  const allLists = ids.allListsViewId
    ? source.view.getViewListsWithItems.queryKey({ viewId: ids.allListsViewId })
    : currentView;
  const selectedView = ids.selectedViewId
    ? source.view.getViewListsWithItems.queryKey({ viewId: ids.selectedViewId })
    : currentView;

  return { views, allLists, currentView, selectedView };
}

export type PersistedOrderPayload = {
  id: string;
  order: number;
};

export type PersistedItemOrderPayload = PersistedOrderPayload & {
  listId: string;
};

function isOptimisticRow(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    "isOptimistic" in value &&
    value.isOptimistic
  );
}

function isOptimisticViewRow(value: ViewCacheItem) {
  return value.userId === "optimistic";
}

export function queryKeysEqual(left: QueryKey, right: QueryKey) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setDashboardQueryDataOnce<T>(
  queryClient: QueryClient,
  updatedKeys: Set<string>,
  queryKey: QueryKey,
  updater: (snapshot: T | undefined) => T | undefined
) {
  const keyHash = JSON.stringify(queryKey);

  if (updatedKeys.has(keyHash)) return;

  updatedKeys.add(keyHash);
  queryClient.setQueryData<T>(queryKey, updater);
}

export function getAllListsSnapshot(
  queryClient: QueryClient,
  allListsQueryKey: QueryKey
) {
  return queryClient.getQueryData<DashboardSnapshot>(allListsQueryKey);
}

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
  allListsSnapshot: DashboardSnapshot | undefined
): CurrentViewSnapshot | undefined {
  if (!view || !allListsSnapshot) return undefined;

  if (view.type === "ALL_LISTS") {
    return {
      ...allListsSnapshot,
      view,
    };
  }

  const viewListOrders = new Map(
    view.viewLists.map((viewList) => [viewList.listId, viewList.order])
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

export function selectedViewFromCache(views: ViewsCache | undefined) {
  return views?.find((view) => view.isDefault) ??
    views?.find((view) => view.type === "ALL_LISTS");
}

export function isLatestSelectedView(
  latestSelectedViewId: string | null | undefined,
  viewId: string | null | undefined
) {
  return Boolean(latestSelectedViewId && viewId && latestSelectedViewId === viewId);
}

export function canApplySelectedViewPayload(
  latestSelectedViewId: string | null | undefined,
  payload: DashboardSnapshot | undefined
) {
  return isLatestSelectedView(latestSelectedViewId, payload?.view.id);
}

export function canRollbackViewSelection(
  latestSelectedViewId: string | null | undefined,
  failedViewId: string | null | undefined
) {
  return isLatestSelectedView(latestSelectedViewId, failedViewId);
}

export function reconcileCreatedListInSnapshot(
  snapshot: DashboardSnapshot | undefined,
  savedList: CreatedListPayload,
  optimisticListId: string
) {
  if (!snapshot) return snapshot;

  const matchingLists = snapshot.lists.filter((list) => list.id === optimisticListId);
  if (matchingLists.length === 0) return snapshot;

  const preservedList = matchingLists.reduce((bestList, list) => {
    if (list.listItems.length !== bestList.listItems.length) {
      return list.listItems.length > bestList.listItems.length ? list : bestList;
    }

    return list.listTags.length > bestList.listTags.length ? list : bestList;
  });
  const [firstMatchingList] = matchingLists;
  let insertedSavedList = false;

  return {
    ...snapshot,
    lists: snapshot.lists.reduce<DashboardSnapshot["lists"]>((nextLists, list) => {
      if (list.id !== optimisticListId) {
        nextLists.push(list);
        return nextLists;
      }

      if (insertedSavedList) {
        return nextLists;
      }

      insertedSavedList = true;
      nextLists.push({
        ...savedList,
        order: firstMatchingList.order,
        listItems: preservedList.listItems.length > 0
          ? preservedList.listItems
          : savedList.listItems ?? [],
        listTags: preservedList.listTags.length > 0
          ? preservedList.listTags
          : savedList.listTags ?? [],
      });
      return nextLists;
    }, []),
  };
}

export function insertOptimisticListIntoDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  optimisticList: DashboardList,
  activeView: { type?: string; id?: string } | undefined
) {
  const updatedKeys = new Set<string>();
  const prepend = (snapshot: DashboardSnapshot | undefined) =>
    snapshot
      ? { ...snapshot, lists: [optimisticList, ...snapshot.lists] }
      : snapshot;
  const prependWhenVisible = (snapshot: DashboardSnapshot | undefined) => {
    if (!snapshot) return snapshot;

    const showsInView =
      activeView?.type !== "CUSTOM" || activeView?.id === snapshot.view.id;

    return showsInView
      ? { ...snapshot, lists: [optimisticList, ...snapshot.lists] }
      : snapshot;
  };

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.allLists, prepend);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.currentView, prependWhenVisible);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.selectedView, prependWhenVisible);
}

export function reconcileCreatedListInDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  savedList: CreatedListPayload,
  optimisticListId: string
) {
  const updatedKeys = new Set<string>();
  const replaceOptimisticList = (snapshot: DashboardSnapshot | undefined) =>
    reconcileCreatedListInSnapshot(snapshot, savedList, optimisticListId);

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.allLists, replaceOptimisticList);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.currentView, replaceOptimisticList);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.selectedView, replaceOptimisticList);
}

export function removeListItemFromDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  itemId: string
) {
  const updatedKeys = new Set<string>();
  const removeItem = (snapshot: DashboardSnapshot | undefined) =>
    snapshot
      ? {
        ...snapshot,
        lists: snapshot.lists.map((list) => ({
          ...list,
          listItems: list.listItems.filter((item) => item.id !== itemId),
        })),
      }
      : snapshot;

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.allLists, removeItem);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.currentView, removeItem);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.selectedView, removeItem);
}

export type DashboardCacheSnapshots = {
  previousAllLists: DashboardSnapshot | undefined;
  previousCurrentView: DashboardSnapshot | undefined;
  previousSelectedView: DashboardSnapshot | undefined;
};

export function rollbackDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  snapshots: DashboardCacheSnapshots
) {
  queryClient.setQueryData(keys.allLists, snapshots.previousAllLists);
  queryClient.setQueryData(keys.currentView, snapshots.previousCurrentView);
  queryClient.setQueryData(keys.selectedView, snapshots.previousSelectedView);
}

export function hasSavedListInDashboardSnapshots(
  snapshots: Array<DashboardSnapshot | undefined>,
  listId: string
) {
  return snapshots.some((snapshot) =>
    snapshot?.lists.some((list) =>
      list.id === listId &&
      !("isOptimistic" in list && list.isOptimistic)
    )
  );
}

export function buildPersistedListOrderPayload(
  lists: DashboardList[]
): PersistedOrderPayload[] {
  return lists
    .filter((list) => !isOptimisticRow(list))
    .map((list, index) => ({
      id: list.id,
      order: index,
    }));
}

export function buildPersistedItemOrderPayload(
  lists: DashboardList[]
): PersistedItemOrderPayload[] {
  return lists.flatMap((list) =>
    isOptimisticRow(list)
      ? []
      : list.listItems
        .filter((item: DashboardListItem) => !isOptimisticRow(item))
        .map((item: DashboardListItem, index: number) => ({
          id: item.id,
          listId: list.id,
          order: index,
        }))
  );
}

export function buildPersistedViewOrderPayload(
  views: ViewCacheItem[]
): PersistedOrderPayload[] {
  return views
    .filter((view) => !isOptimisticViewRow(view))
    .map((view, index) => ({
      id: view.id,
      order: index,
    }));
}

export function applyViewSelectionToViews(
  views: ViewsCache | undefined,
  viewId: string
) {
  return views?.map((view) => ({
    ...view,
    isDefault: view.id === viewId,
  }));
}

export function applyViewSelection(
  queryClient: QueryClient,
  keys: DashboardKeys,
  viewId: string
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (views) =>
    applyViewSelectionToViews(views, viewId)
  );

  const views = queryClient.getQueryData<ViewsCache>(keys.views);
  const selectedView = views?.find((view) => view.id === viewId);
  const allListsSnapshot = getAllListsSnapshot(queryClient, keys.allLists);

  queryClient.setQueryData(keys.currentView, projectView(selectedView, allListsSnapshot));
}

export type ViewMutationSnapshots = {
  previousViews: ViewsCache | undefined;
  previousCurrentView: CurrentViewSnapshot | undefined;
};

export function captureViewMutationSnapshots(
  queryClient: QueryClient,
  keys: DashboardKeys
): ViewMutationSnapshots {
  return {
    previousViews: queryClient.getQueryData<ViewsCache>(keys.views),
    previousCurrentView: queryClient.getQueryData<CurrentViewSnapshot>(keys.currentView),
  };
}

export function rollbackViewMutationCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  snapshots: ViewMutationSnapshots
) {
  queryClient.setQueryData(keys.views, snapshots.previousViews);
  queryClient.setQueryData(keys.currentView, snapshots.previousCurrentView);
}

export function insertOptimisticViewIntoDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  optimisticView: ViewCacheItem,
  allListsSnapshot: DashboardSnapshot | undefined
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews = []) => [
    optimisticView,
    ...currentViews.map((view) => ({ ...view, isDefault: false })),
  ].sort((a, b) => a.order - b.order));
  queryClient.setQueryData(
    keys.currentView,
    projectView(optimisticView, allListsSnapshot)
  );
}

export function reconcileCreatedViewInViewsCache(
  queryClient: QueryClient,
  keys: DashboardKeys,
  createdView: Partial<ViewCacheItem> & Pick<ViewCacheItem, "id">
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews = []) =>
    currentViews.map((view) =>
      view.id === createdView.id ? { ...view, ...createdView } : view
    )
  );
}

export function reconcileUpdatedViewInViewsCache(
  queryClient: QueryClient,
  keys: DashboardKeys,
  updatedView: Partial<ViewCacheItem> & Pick<ViewCacheItem, "id">
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews) =>
    currentViews?.map((view) =>
      view.id === updatedView.id ? { ...view, ...updatedView } : view
    )
  );
}

export function applyViewRenameToViewsCache(
  queryClient: QueryClient,
  keys: DashboardKeys,
  viewId: string,
  name: string
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews) =>
    currentViews?.map((view) =>
      view.id === viewId ? { ...view, name } : view
    )
  );
}

export function applyViewFilterUpdateToCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  params: {
    viewId: string;
    selectedTags: DashboardTag[];
    allListsSnapshot: DashboardSnapshot | undefined;
  }
) {
  const { viewId, selectedTags, allListsSnapshot } = params;
  let editedView: ViewCacheItem | undefined;

  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews) =>
    currentViews?.map((view) => {
      if (view.id !== viewId) return view;

      editedView = {
        ...view,
        viewTags: selectedTags.map((tag) => ({
          viewId,
          tagId: tag.id,
          tag,
        })),
      };

      editedView.viewLists = (allListsSnapshot?.lists ?? [])
        .filter((list) => (editedView ? listMatchesView(list, editedView) : false))
        .map((list) => ({ listId: list.id, order: list.order }));

      return editedView;
    })
  );

  if (editedView?.isDefault) {
    queryClient.setQueryData(
      keys.currentView,
      projectView(editedView, allListsSnapshot)
    );
  }
}

export function removeViewFromDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  viewId: string,
  allListsSnapshot: DashboardSnapshot | undefined
) {
  const previousViews = queryClient.getQueryData<ViewsCache>(keys.views);
  const deletedView = previousViews?.find((view) => view.id === viewId);
  const fallbackView = previousViews?.find((view) => view.type === "ALL_LISTS");

  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews) =>
    currentViews
      ?.filter((view) => view.id !== viewId)
      .map((view) => ({
        ...view,
        isDefault: deletedView?.isDefault ? view.id === fallbackView?.id : view.isDefault,
      }))
  );

  if (deletedView?.isDefault && fallbackView) {
    queryClient.setQueryData(
      keys.currentView,
      projectView(fallbackView, allListsSnapshot)
    );
  }
}

export function commitViewOrderToViewsCache(
  queryClient: QueryClient,
  keys: DashboardKeys,
  nextViews: ViewCacheItem[]
) {
  queryClient.setQueryData<ViewsCache>(keys.views, (currentViews = []) => {
    const fixedViews = currentViews.filter((view) => view.type !== "CUSTOM");
    return [...fixedViews, ...nextViews].sort((a, b) => a.order - b.order);
  });
}

export function applySelectedViewPayloadToCurrentView(
  queryClient: QueryClient,
  keys: DashboardKeys,
  latestSelectedViewId: string | null | undefined,
  payload: DashboardSnapshot | undefined
) {
  if (canApplySelectedViewPayload(latestSelectedViewId, payload)) {
    queryClient.setQueryData(keys.currentView, payload);
  }
}

export function rollbackSelectedView(
  queryClient: QueryClient,
  keys: DashboardKeys,
  latestSelectedViewId: string | null | undefined,
  failedViewId: string | null | undefined,
  snapshots: ViewMutationSnapshots
) {
  if (!canRollbackViewSelection(latestSelectedViewId, failedViewId)) return;
  queryClient.setQueryData(keys.views, snapshots.previousViews);
  queryClient.setQueryData(keys.currentView, snapshots.previousCurrentView);
}

export function updateListInDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  listId: string,
  updater: (list: DashboardList) => DashboardList
) {
  const updatedKeys = new Set<string>();
  let updatedAllListsSnapshot: DashboardSnapshot | undefined;

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.allLists, (snapshot) => {
    if (!snapshot) return snapshot;

    updatedAllListsSnapshot = {
      ...snapshot,
      lists: snapshot.lists.map((list) =>
        list.id === listId ? updater(list) : list
      ),
    };

    return updatedAllListsSnapshot;
  });

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.currentView, (snapshot) => {
    if (!snapshot) return snapshot;

    if (updatedAllListsSnapshot) {
      return projectView(snapshot.view, updatedAllListsSnapshot);
    }

    return updateListInViewSnapshot(snapshot, listId, updater);
  });

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.selectedView, (snapshot) => {
    if (!snapshot) return snapshot;

    if (updatedAllListsSnapshot) {
      return projectView(snapshot.view, updatedAllListsSnapshot);
    }

    return updateListInViewSnapshot(snapshot, listId, updater);
  });
}

function updateListInViewSnapshot(
  snapshot: DashboardSnapshot,
  listId: string,
  updater: (list: DashboardList) => DashboardList
) {
  const selectedView = snapshot.view;
  const updatedLists = snapshot.lists.map((list) =>
    list.id === listId ? updater(list) : list
  );

  return {
    ...snapshot,
    lists: updatedLists.filter((list) => listMatchesView(list, selectedView)),
  };
}

export function removeListFromDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  listId: string
) {
  const updatedKeys = new Set<string>();
  const removeList = (snapshot: DashboardSnapshot | undefined) =>
    snapshot
      ? {
        ...snapshot,
        lists: snapshot.lists.filter((list) => list.id !== listId),
      }
      : snapshot;

  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.allLists, removeList);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.currentView, removeList);
  setDashboardQueryDataOnce<DashboardSnapshot>(queryClient, updatedKeys, keys.selectedView, removeList);
}

export function invalidateViewPayloadQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      JSON.stringify(query.queryKey).includes("getViewListsWithItems"),
  });
}

export function applyTagChangeToCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  listId: string,
  tag: DashboardTag,
  action: "add" | "remove"
) {
  updateListInDashboardCaches(queryClient, keys, listId, (list) => {
    const hasTag = list.listTags.some((listTag) => listTag.tagId === tag.id);

    if (action === "add" && hasTag) return list;
    if (action === "remove" && !hasTag) return list;

    return {
      ...list,
      listTags: action === "add"
        ? [
          ...list.listTags,
          {
            listId,
            tagId: tag.id,
            tag,
          },
        ]
        : list.listTags.filter((listTag) => listTag.tagId !== tag.id),
    };
  });
}

export function applyDeletedTagToDashboardCaches(
  queryClient: QueryClient,
  keys: DashboardKeys,
  tagId: string
) {
  const stripDeletedTagFromView = (view: ViewCacheItem) => ({
    ...view,
    viewTags: view.viewTags.filter((viewTag) => viewTag.tagId !== tagId),
  });
  const stripDeletedTagFromList = (list: DashboardList) => ({
    ...list,
    listTags: list.listTags.filter((listTag) => listTag.tagId !== tagId),
  });
  const updatedKeys = new Set<string>();
  let updatedAllListsSnapshot: DashboardSnapshot | undefined;

  queryClient.setQueryData<ViewsCache>(keys.views, (views) =>
    views?.map(stripDeletedTagFromView)
  );

  const views = queryClient.getQueryData<ViewsCache>(keys.views);
  const viewFromCache = (view: ViewCacheItem) =>
    views?.find((cachedView) => cachedView.id === view.id) ??
    stripDeletedTagFromView(view);

  setDashboardQueryDataOnce<DashboardSnapshot>(
    queryClient,
    updatedKeys,
    keys.allLists,
    (snapshot) => {
      if (!snapshot) return snapshot;

      updatedAllListsSnapshot = {
        ...snapshot,
        view: viewFromCache(snapshot.view),
        lists: snapshot.lists.map(stripDeletedTagFromList),
      };

      return updatedAllListsSnapshot;
    }
  );

  const reprojectDeletedTag = (snapshot: DashboardSnapshot | undefined) => {
    if (!snapshot) return snapshot;

    const projectionSource = updatedAllListsSnapshot ?? {
      ...snapshot,
      view: viewFromCache(snapshot.view),
      lists: snapshot.lists.map(stripDeletedTagFromList),
    };

    return projectView(viewFromCache(snapshot.view), projectionSource);
  };

  setDashboardQueryDataOnce<DashboardSnapshot>(
    queryClient,
    updatedKeys,
    keys.currentView,
    reprojectDeletedTag
  );
  setDashboardQueryDataOnce<DashboardSnapshot>(
    queryClient,
    updatedKeys,
    keys.selectedView,
    reprojectDeletedTag
  );
}

export function reconcileSavedListTags(
  queryClient: QueryClient,
  keys: DashboardKeys,
  listId: string,
  listTags: SavedListTags
) {
  const savedTagById = new Map(
    listTags.map((listTag) => [listTag.tagId, listTag])
  );

  updateListInDashboardCaches(queryClient, keys, listId, (list) => ({
    ...list,
    listTags: [
      ...list.listTags
        .filter((listTag) => savedTagById.has(listTag.tagId))
        .map((listTag) => savedTagById.get(listTag.tagId)!),
      ...listTags.filter((listTag) =>
        !list.listTags.some((currentListTag) =>
          currentListTag.tagId === listTag.tagId
        )
      ),
    ],
  }));
}

export function reconcileAffectedViewLists(
  queryClient: QueryClient,
  keys: DashboardKeys,
  affectedViews: AffectedTagView[]
) {
  if (affectedViews.length === 0) return;

  const affectedViewById = new Map(
    affectedViews.map((view) => [view.id, view])
  );

  queryClient.setQueryData<ViewsCache>(keys.views, (views) =>
    views?.map((view) => {
      const affectedView = affectedViewById.get(view.id);

      return affectedView ? { ...view, ...affectedView } : view;
    })
  );

  const allListsSnapshot = getAllListsSnapshot(queryClient, keys.allLists);
  if (!allListsSnapshot) return;

  const views = queryClient.getQueryData<ViewsCache>(keys.views);
  const reprojectAffectedView = (snapshot: DashboardSnapshot | undefined) => {
    if (!snapshot) return snapshot;

    const updatedView = affectedViewById.get(snapshot.view.id) ??
      views?.find((view) => view.id === snapshot.view.id) ??
      snapshot.view;

    return projectView(updatedView, allListsSnapshot);
  };

  const updatedKeys = new Set<string>();
  setDashboardQueryDataOnce<DashboardSnapshot>(
    queryClient,
    updatedKeys,
    keys.currentView,
    reprojectAffectedView
  );
  setDashboardQueryDataOnce<DashboardSnapshot>(
    queryClient,
    updatedKeys,
    keys.selectedView,
    reprojectAffectedView
  );
}

export function rollbackScope<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  snapshot: T | undefined
) {
  queryClient.setQueryData(queryKey, snapshot);
}
