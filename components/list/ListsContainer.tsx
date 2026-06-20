"use client";

import { DragDropProvider } from '@dnd-kit/react';
import { useCallback, useRef, useState } from 'react';

import { useDashboardMutations } from '@/hooks/useDashboardMutations';
import type { LocalFirstDashboardBoot } from '@/hooks/useLocalFirstDashboardBoot';
import { useReplicacheDashboard } from '@/hooks/useReplicacheDashboard';
import { measureOptimisticEvent, OptimisticProfiler, useRenderMeasure } from '@/lib/optimistic-debug';
import { filterListsByWorkspace } from '@/lib/dashboard/workspace-filter';
import { keyBetween } from '@/lib/sync/fractional-index';
import { replicacheKeys } from '@/lib/sync/replicache/keys';
import ListComponent from './ListComponent';
import ListEmpty from './ListEmpty';
import ListItemComponent from './ListItemComponent';
import ListSkeleton from './ListSkeleton';
import { List, Lists, OptimisticList, OptimisticListItem } from './types';

type DragPreviewLists = Lists;
type ListsContainerProps = {
  boot: LocalFirstDashboardBoot;
  activeWorkspaceId: string | null;
};

function canEditListContent(list: List, userId: string | null) {
  const role =
    list.accessRole ?? (list.userId === userId ? "OWNER" : "VIEWER");
  return role === "OWNER" || role === "EDITOR";
}

function findTargetList(
  lists: Lists,
  targetType: string,
  targetId: string,
) {
  if (targetType === "list-drop") {
    const listId = targetId.replace("list-drop-", "");
    return lists.find((list) => list.id === listId);
  }
  if (targetType === "list-item") {
    const itemId = targetId.replace("list-item-", "");
    return lists.find((list) =>
      list.listItems.some((item) => item.id === itemId)
    );
  }
  return undefined;
}

function reorderListsForDrag(
  baseLists: Lists,
  sourceListId: string,
  targetListId: string
): DragPreviewLists | null {
  const sourceIndex = baseLists.findIndex((list) => list.id === sourceListId);
  const targetIndex = baseLists.findIndex((list) => list.id === targetListId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return null;
  }

  const nextLists = [...baseLists];
  const [movedList] = nextLists.splice(sourceIndex, 1);
  nextLists.splice(targetIndex, 0, movedList);

  return nextLists.map((list, index) => ({
    ...list,
    order: index,
  }));
}

function reorderItemsForDrag(
  baseLists: Lists,
  draggedItemId: string,
  targetType: string,
  targetId: string
): DragPreviewLists | null {
  const sourceListIndex = baseLists.findIndex((list) =>
    list.listItems.some((item) => item.id === draggedItemId)
  );

  if (sourceListIndex === -1) return null;

  const sourceItemIndex = baseLists[sourceListIndex].listItems.findIndex(
    (item) => item.id === draggedItemId
  );

  if (sourceItemIndex === -1) return null;

  let targetListIndex = -1;
  let targetItemIndex = 0;

  if (targetType === "list-item") {
    const targetItemId = targetId.replace("list-item-", "");

    targetListIndex = baseLists.findIndex((list) =>
      list.listItems.some((item) => item.id === targetItemId)
    );

    if (targetListIndex === -1) return null;

    targetItemIndex = baseLists[targetListIndex].listItems.findIndex(
      (item) => item.id === targetItemId
    );
  }

  if (targetType === "list-drop") {
    const targetListId = targetId.replace("list-drop-", "");

    targetListIndex = baseLists.findIndex((list) => list.id === targetListId);

    if (targetListIndex === -1) return null;

    targetItemIndex = baseLists[targetListIndex].listItems.length;
  }

  if (targetListIndex === -1) return null;

  if (
    sourceListIndex === targetListIndex &&
    sourceItemIndex === targetItemIndex
  ) {
    return null;
  }

  const nextLists = [...baseLists];
  const nextSourceList: List = {
    ...nextLists[sourceListIndex],
    listItems: [...nextLists[sourceListIndex].listItems],
  };
  nextLists[sourceListIndex] = nextSourceList;

  if (sourceListIndex !== targetListIndex) {
    nextLists[targetListIndex] = {
      ...nextLists[targetListIndex],
      listItems: [...nextLists[targetListIndex].listItems],
    };
  }

  const [movedItem] = nextLists[sourceListIndex].listItems.splice(
    sourceItemIndex,
    1
  );

  let insertIndex = targetItemIndex;

  if (sourceListIndex === targetListIndex && sourceItemIndex < targetItemIndex) {
    insertIndex -= 1;
  }

  nextLists[targetListIndex].listItems.splice(insertIndex, 0, {
    ...movedItem,
    listId: nextLists[targetListIndex].id,
  });

  nextLists[sourceListIndex] = {
    ...nextLists[sourceListIndex],
    listItems: nextLists[sourceListIndex].listItems.map((item, index) => ({
      ...item,
      order: index,
    })),
  };

  if (sourceListIndex !== targetListIndex) {
    nextLists[targetListIndex] = {
      ...nextLists[targetListIndex],
      listItems: nextLists[targetListIndex].listItems.map((item, index) => ({
        ...item,
        order: index,
      })),
    };
  }

  return nextLists;
}

function listOrderMatches(left: Lists, right: Lists) {
  return left.length === right.length &&
    left.every((list, index) => list.id === right[index]?.id);
}

function itemPlacementMatches(left: Lists, right: Lists) {
  return left.length === right.length &&
    left.every((list, listIndex) =>
      list.id === right[listIndex]?.id &&
      list.listItems.length === right[listIndex]?.listItems.length &&
      list.listItems.every((item, itemIndex) =>
        item.id === right[listIndex]?.listItems[itemIndex]?.id &&
        item.listId === right[listIndex]?.listItems[itemIndex]?.listId
      )
    );
}

function movedEntityOrderKey(
  orderedIds: string[],
  movedId: string,
  currentKeys: ReadonlyMap<string, string>,
) {
  const movedIndex = orderedIds.indexOf(movedId);
  const beforeId = movedIndex > 0 ? orderedIds[movedIndex - 1] : undefined;
  const afterId = movedIndex >= 0 && movedIndex < orderedIds.length - 1
    ? orderedIds[movedIndex + 1]
    : undefined;

  return keyBetween(
    beforeId ? currentKeys.get(beforeId) ?? null : null,
    afterId ? currentKeys.get(afterId) ?? null : null,
  );
}

const ListsContainer = ({ boot, activeWorkspaceId }: ListsContainerProps) => {
  const replicacheDashboard = useReplicacheDashboard();
  const dashboardMutations = useDashboardMutations();

  useRenderMeasure("ListsContainer");

  const [activeDropTarget, setActiveDropTarget] = useState<{
    type: string;
    id: string;
  } | null>(null);
  const [dragPreviewLists, setDragPreviewLists] = useState<DragPreviewLists | null>(null);
  const dragPreviewListsRef = useRef<DragPreviewLists | null>(null);
  const currentView = replicacheDashboard.currentView;
  const allListsView = replicacheDashboard.views.find((view) => view.type === "ALL_LISTS");
  const lists = filterListsByWorkspace(
    currentView?.lists ?? [],
    activeWorkspaceId,
  );
  const visibleLists = dragPreviewLists ?? lists;

  const scheduleReorderListsSave = useCallback(async (
    nextLists: Lists,
    movedListId: string,
  ) => {
    if (!boot.userId || !currentView || !dashboardMutations.mutate) return;

    const currentKeys = new Map<string, string>();
    for (const list of nextLists) {
      const key = replicacheDashboard.orderKeys.viewLists.get(
        replicacheKeys.viewList(currentView.view.id, list.id),
      );
      if (key) currentKeys.set(list.id, key);
    }

    await dashboardMutations.mutate.reorderLists({
      viewId: currentView.view.id,
      listId: movedListId,
      orderKey: movedEntityOrderKey(
        nextLists.map((list) => list.id),
        movedListId,
        currentKeys,
      ),
    });
  }, [
    boot.userId,
    currentView,
    dashboardMutations.mutate,
    replicacheDashboard.orderKeys.viewLists,
  ]);

  const scheduleReorderListItemsSave = useCallback(async (
    previousLists: Lists,
    nextLists: Lists,
    movedItemId: string,
  ) => {
    if (!boot.userId || !dashboardMutations.mutate) return;

    const previousList = previousLists.find((list) =>
      list.listItems.some((item) => item.id === movedItemId)
    );
    const destinationList = nextLists.find((list) =>
      list.listItems.some((item) => item.id === movedItemId)
    );
    if (!previousList || !destinationList) return;

    const orderKey = movedEntityOrderKey(
      destinationList.listItems.map((item) => item.id),
      movedItemId,
      replicacheDashboard.orderKeys.listItems,
    );

    if (previousList.id !== destinationList.id) {
      await dashboardMutations.mutate.moveItem({
        id: movedItemId,
        fromListId: previousList.id,
        toListId: destinationList.id,
        order: orderKey,
        now: new Date().toISOString(),
      });
      return;
    }

    await dashboardMutations.mutate.reorderItems({
      listId: destinationList.id,
      id: movedItemId,
      orderKey,
    });
  }, [
    boot.userId,
    dashboardMutations.mutate,
    replicacheDashboard.orderKeys.listItems,
  ]);

  const setLocalDragPreview = useCallback((nextLists: DragPreviewLists | null) => {
    dragPreviewListsRef.current = nextLists;
    setDragPreviewLists(nextLists);
  }, [setDragPreviewLists]);

  const applyLocalDragPreview = useCallback((nextLists: DragPreviewLists) => {
    dragPreviewListsRef.current = nextLists;
    setDragPreviewLists(nextLists);
  }, [setDragPreviewLists]);

  const [revealedItemIds, setRevealedItemIds] = useState(() => new Set<string>());
  const [revealedListIds, setRevealedListIds] = useState(() => new Set<string>());

  const revealList = useCallback((listId: string) => {
    setRevealedListIds((currentIds) => new Set(currentIds).add(listId));
  }, []);

  const revealItem = useCallback((itemId: string) => {
    setRevealedItemIds((currentIds) => new Set(currentIds).add(itemId));
  }, []);

  if (!replicacheDashboard.ready || !allListsView) {
    return <div className="grow grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
    </div>;
  }

  if (visibleLists.length === 0) {
    return <div className='w-full h-full'>
      <ListEmpty boot={boot} />
    </div>;
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        measureOptimisticEvent("drag.start", { lists: lists.length });
        setLocalDragPreview(lists);
      }}

      onDragEnd={(e) => {
        setActiveDropTarget(null);

        const { source, target } = e.operation;
        let finalPreview = dragPreviewListsRef.current;

        setLocalDragPreview(null);

        if (e.canceled) {
          measureOptimisticEvent("drag.cancel");
          return;
        }

        if (!source || !finalPreview) return;

        measureOptimisticEvent("drag.end", {
          sourceType: source.type,
          lists: finalPreview.length,
        });

        if (
          source.type === "list" &&
          target?.type === "list" &&
          listOrderMatches(finalPreview, lists)
        ) {
          const sourceListId = String(source.id).replace("list-", "");
          const targetListId = String(target.id).replace("list-", "");
          const sourceList = lists.find((list) => list.id === sourceListId);
          const targetList = lists.find((list) => list.id === targetListId);
          if (
            sourceList?.userId === boot.userId &&
            targetList?.userId === boot.userId
          ) {
            finalPreview =
              reorderListsForDrag(lists, sourceListId, targetListId) ??
              finalPreview;
          }
        }

        switch (source.type) {
          case "list":
            if (!listOrderMatches(finalPreview, lists)) {
              void scheduleReorderListsSave(
                finalPreview,
                String(source.id).replace("list-", ""),
              );
            }
            break;

          case "list-item":
            if (!itemPlacementMatches(finalPreview, lists)) {
              void scheduleReorderListItemsSave(
                lists,
                finalPreview,
                String(source.id).replace("list-item-", ""),
              );
            }
            break;

          default:
            break;
        }
      }}

      onDragOver={(event) => {
        const { source, target } = event.operation;

        if (!source || !target) {
          setActiveDropTarget(null);
          return;
        };

        setActiveDropTarget({
          type: String(target.type),
          id: String(target.id),
        });

        measureOptimisticEvent("drag.over", {
          sourceType: source.type,
          targetType: target.type,
        });

        if (source.type === "list" && target.type === "list") {
          const sourceListId = String(source.id).replace("list-", "");
          const targetListId = String(target.id).replace("list-", "");
          const sourceList = lists.find((list) => list.id === sourceListId);
          const targetList = lists.find((list) => list.id === targetListId);
          if (
            sourceList?.userId !== boot.userId ||
            targetList?.userId !== boot.userId
          ) {
            return;
          }
          const nextLists = reorderListsForDrag(
            dragPreviewListsRef.current ?? lists,
            sourceListId,
            targetListId
          );

          if (nextLists) applyLocalDragPreview(nextLists);
          return;
        }

        if (source.type !== "list-item") return;

        const draggedItemId = String(source.id).replace("list-item-", "");
        const sourceList = lists.find((list) =>
          list.listItems.some((item) => item.id === draggedItemId)
        );
        const targetList = findTargetList(
          lists,
          String(target.type),
          String(target.id),
        );
        if (
          !sourceList ||
          !targetList ||
          !canEditListContent(sourceList, boot.userId) ||
          !canEditListContent(targetList, boot.userId)
        ) {
          return;
        }
        const nextLists = reorderItemsForDrag(
          dragPreviewListsRef.current ?? lists,
          draggedItemId,
          String(target.type),
          String(target.id)
        );

        if (nextLists) applyLocalDragPreview(nextLists);
      }}
    >

      <OptimisticProfiler id="dashboard-list-grid">
        <div className="grow grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {
            visibleLists.map((list: OptimisticList, index) =>
              <ListComponent
                key={list.id}
                listValues={list}
                index={index}
                userId={boot.userId}
                activeDropTarget={activeDropTarget}
                shouldRevealOnMount={
                  Boolean(list.isOptimistic) && !revealedListIds.has(list.id)
                }
                onRevealComplete={() => revealList(list.id)}
              >
                {
                  list.listItems?.map((item: OptimisticListItem, index: number) =>
                    <ListItemComponent
                      key={item.id}
                      listItem={item}
                      index={index}
                      userId={boot.userId}
                      canEdit={canEditListContent(list, boot.userId)}
                      shouldRevealOnMount={
                        Boolean(item.isOptimistic) && !revealedItemIds.has(item.id)
                      }
                      onRevealComplete={() => revealItem(item.id)}
                    />)
                }
              </ListComponent>
            )
          }
        </div>
      </OptimisticProfiler>
    </DragDropProvider>
  );
};

export default ListsContainer;
