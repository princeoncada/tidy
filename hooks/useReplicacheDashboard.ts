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

export type ReplicacheOrderKeys = {
  views: ReadonlyMap<string, string>;
  viewLists: ReadonlyMap<string, string>;
  listItems: ReadonlyMap<string, string>;
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

function compareOrderKeys(
  leftKey: string,
  rightKey: string,
  leftId: string,
  rightId: string,
) {
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return leftId.localeCompare(rightId);
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
  const sortedGraphViews = [...graph.views].sort((left, right) =>
    compareOrderKeys(left.order, right.order, left.id, right.id)
  );
  const views: ViewsCache = sortedGraphViews
    .map((view, viewIndex) => ({
      ...view,
      order: viewIndex,
      isDefault: graph.selectedViewId
        ? view.id === graph.selectedViewId
        : view.isDefault,
      createdAt: toDate(view.createdAt),
      updatedAt: toDate(view.updatedAt),
      viewLists: graph.viewLists
        .filter((viewList) => viewList.viewId === view.id)
        .sort((left, right) =>
          compareOrderKeys(
            left.order,
            right.order,
            left.listId,
            right.listId,
          )
        )
        .map((viewList, index) => ({
          listId: viewList.listId,
          order: index,
        })),
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
    }));
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
              .sort((left, right) =>
                compareOrderKeys(
                  left.order,
                  right.order,
                  left.id,
                  right.id,
                )
              )
              .map((item, itemIndex) => ({
                ...item,
                order: itemIndex,
                createdAt: toDate(item.createdAt),
                updatedAt: toDate(item.updatedAt),
              })),
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
  const orderKeys: ReplicacheOrderKeys = {
    views: new Map(graph.views.map((view) => [view.id, view.order])),
    viewLists: new Map(
      graph.viewLists.map((viewList) => [
        replicacheKeys.viewList(viewList.viewId, viewList.listId),
        viewList.order,
      ]),
    ),
    listItems: new Map(
      graph.listItems.map((item) => [item.id, item.order]),
    ),
  };

  return {
    views,
    tags,
    allLists,
    selectedView,
    currentView: projectView(selectedView, allLists),
    orderKeys,
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
    enabled: true,
    ready: Boolean(rep && dashboard.currentView),
    ...dashboard,
  };
}
