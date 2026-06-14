"use client";

import { useSubscribe } from "replicache-react";

import { useTidyReplicache } from "@/components/ReplicacheProvider";
import {
  projectView,
  selectedViewFromCache,
  type DashboardSnapshot,
  type DashboardTag,
  type ViewsCache,
} from "@/lib/dashboard-cache";
import {
  REPLICACHE_KEY_PREFIXES,
  replicacheKeys,
  type ReplicacheListItemValue,
  type ReplicacheListTagValue,
  type ReplicacheListValue,
  type ReplicacheTagValue,
  type ReplicacheViewListValue,
  type ReplicacheViewTagValue,
  type ReplicacheViewValue,
} from "@/lib/sync/replicache/keys";

export type ReplicacheDashboardGraph = {
  lists: ReadonlyArray<ReplicacheListValue>;
  listItems: ReadonlyArray<ReplicacheListItemValue>;
  tags: ReadonlyArray<ReplicacheTagValue>;
  views: ReadonlyArray<ReplicacheViewValue>;
  viewLists: ReadonlyArray<ReplicacheViewListValue>;
  viewTags: ReadonlyArray<ReplicacheViewTagValue>;
  listTags: ReadonlyArray<ReplicacheListTagValue>;
  selectedViewId: string | undefined;
};

const EMPTY_GRAPH: ReplicacheDashboardGraph = {
  lists: [],
  listItems: [],
  tags: [],
  views: [],
  viewLists: [],
  viewTags: [],
  listTags: [],
  selectedViewId: undefined,
};

function toDate(value: string) {
  return new Date(value);
}

export function assembleReplicacheDashboard(
  graph: ReplicacheDashboardGraph,
) {
  const tags: DashboardTag[] = graph.tags
    .map((tag) => ({
      ...tag,
      createdAt: toDate(tag.createdAt),
      updatedAt: toDate(tag.updatedAt),
      listTags: graph.listTags
        .filter((listTag) => listTag.tagId === tag.id)
        .map((listTag) => ({
          listId: listTag.listId,
          tagId: listTag.tagId,
        })),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const views: ViewsCache = graph.views
    .map((view) => ({
      ...view,
      isDefault: graph.selectedViewId
        ? view.id === graph.selectedViewId
        : view.isDefault,
      createdAt: toDate(view.createdAt),
      updatedAt: toDate(view.updatedAt),
      viewLists: graph.viewLists
        .filter((viewList) => viewList.viewId === view.id)
        .map((viewList) => ({
          listId: viewList.listId,
          order: viewList.order,
        }))
        .sort((left, right) =>
          left.order - right.order || left.listId.localeCompare(right.listId)
        ),
      viewTags: graph.viewTags
        .filter((viewTag) => viewTag.viewId === view.id)
        .flatMap((viewTag) => {
          const tag = tagById.get(viewTag.tagId);
          return tag
            ? [{
                viewId: view.id,
                tagId: viewTag.tagId,
                tag,
              }]
            : [];
        })
        .sort((left, right) => left.tagId.localeCompare(right.tagId)),
    }))
    .sort((left, right) =>
      left.order - right.order || left.id.localeCompare(right.id)
    );
  const allListsView = views.find((view) => view.type === "ALL_LISTS");
  const allListsOrders = new Map(
    allListsView?.viewLists.map((viewList) => [
      viewList.listId,
      viewList.order,
    ]) ?? [],
  );
  const allLists: DashboardSnapshot | undefined = allListsView
    ? {
        view: allListsView,
        lists: graph.lists
          .map((list, index) => ({
            ...list,
            order: allListsOrders.get(list.id) ?? index,
            createdAt: toDate(list.createdAt),
            updatedAt: toDate(list.updatedAt),
            listItems: graph.listItems
              .filter((item) => item.listId === list.id)
              .map((item) => ({
                ...item,
                createdAt: toDate(item.createdAt),
                updatedAt: toDate(item.updatedAt),
              }))
              .sort((left, right) =>
                left.order - right.order || left.id.localeCompare(right.id)
              ),
            listTags: graph.listTags
              .filter((listTag) => listTag.listId === list.id)
              .flatMap((listTag) => {
                const tag = tagById.get(listTag.tagId);
                return tag
                  ? [{
                      listId: list.id,
                      tagId: listTag.tagId,
                      tag,
                    }]
                  : [];
              })
              .sort((left, right) => left.tagId.localeCompare(right.tagId)),
          }))
          .sort((left, right) =>
            left.order - right.order || left.id.localeCompare(right.id)
          ),
      }
    : undefined;
  const selectedView = selectedViewFromCache(views);

  return {
    views,
    tags,
    allLists,
    selectedView,
    currentView: projectView(selectedView, allLists),
  };
}

export function useReplicacheDashboard() {
  const { rep } = useTidyReplicache();
  const graph = useSubscribe(
    rep,
    async (tx): Promise<ReplicacheDashboardGraph> => ({
      lists: await tx
        .scan<ReplicacheListValue>({
          prefix: REPLICACHE_KEY_PREFIXES.list,
        })
        .values()
        .toArray(),
      listItems: await tx
        .scan<ReplicacheListItemValue>({
          prefix: REPLICACHE_KEY_PREFIXES.listItem,
        })
        .values()
        .toArray(),
      tags: await tx
        .scan<ReplicacheTagValue>({
          prefix: REPLICACHE_KEY_PREFIXES.tag,
        })
        .values()
        .toArray(),
      views: await tx
        .scan<ReplicacheViewValue>({
          prefix: REPLICACHE_KEY_PREFIXES.view,
        })
        .values()
        .toArray(),
      viewLists: await tx
        .scan<ReplicacheViewListValue>({
          prefix: REPLICACHE_KEY_PREFIXES.viewList,
        })
        .values()
        .toArray(),
      viewTags: await tx
        .scan<ReplicacheViewTagValue>({
          prefix: REPLICACHE_KEY_PREFIXES.viewTag,
        })
        .values()
        .toArray(),
      listTags: await tx
        .scan<ReplicacheListTagValue>({
          prefix: REPLICACHE_KEY_PREFIXES.listTag,
        })
        .values()
        .toArray(),
      selectedViewId: await tx.get<string>(replicacheKeys.selectedView),
    }),
    { default: EMPTY_GRAPH },
  );
  const dashboard = assembleReplicacheDashboard(graph);

  return {
    enabled: Boolean(rep),
    ready: !rep || Boolean(dashboard.currentView),
    ...dashboard,
  };
}
