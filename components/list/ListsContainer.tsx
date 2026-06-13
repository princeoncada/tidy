"use client";

import {
  buildDashboardKeys,
  canApplySelectedViewPayload,
  DashboardSnapshot,
  selectedViewFromCache,
  ViewsCache,
} from '@/lib/dashboard-cache';
import {
  measureCacheWrite,
  measureOptimisticEvent,
  OptimisticProfiler,
  useRenderMeasure,
} from '@/lib/optimistic-debug';
import { useOptimisticSync } from '@/hooks/useOptimisticSync';
import type { LocalFirstDashboardBoot } from '@/hooks/useLocalFirstDashboardBoot';
import { LOCAL_ALL_LISTS_VIEW_ID, resolveDashboardCurrentView } from '@/lib/local-first-dashboard';
import { reconcileServerGraphIntoLocalPlan } from '@/lib/local-first-reconcile';
import {
  applyLocalGraphReconcilePlan,
  listLocalListItemsForUser,
  listLocalListsForUser,
  listLocalListTagsForUser,
  listLocalTagsForUser,
  listLocalViewListsForUser,
  listLocalViewsForUser,
  listLocalViewTagsForUser,
} from '@/lib/local-db/local-repositories';
import {
  translateListItemMovement,
} from '@/lib/local-db/local-movement';
import {
  applyPendingOutboxOverlay,
  applyPendingViewOverlay,
  outboxOperationsSignature,
  readActiveOutboxOperationsForUser,
  readPendingOutboxOperationsForUser,
  relinquishConfirmedOperations,
} from '@/lib/local-db/local-overlay';
import {
  commitLocalListItemMove,
  commitLocalListItemReorder,
  commitLocalListReorder,
} from '@/lib/local-db/local-write';
import { subscribeToOutboxCaptures } from '@/lib/sync/outbox-capture-events';
import { useTRPC } from '@/trpc/client';
import { DragDropProvider } from '@dnd-kit/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ListComponent from './ListComponent';
import ListItemComponent from './ListItemComponent';
import ListSkeleton from './ListSkeleton';
import { CurrentView, List, Lists, OptimisticList, OptimisticListItem } from './types';
import ListEmpty from './ListEmpty';

type DragPreviewLists = Lists;
type ListsContainerProps = {
  boot: LocalFirstDashboardBoot;
};

function isOptimisticCacheRow(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    "isOptimistic" in value &&
    value.isOptimistic
  );
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

const EMPTY_VIEW_ID = "00000000-0000-0000-0000-000000000000";

const ListsContainer = ({ boot }: ListsContainerProps) => {

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const movementCaptureEnabled = Boolean(boot.userId);
  const [pendingMovementOperations, setPendingMovementOperations] = useState<
    Parameters<typeof applyPendingOutboxOverlay>[1]
  >([]);
  const [movementOperationsUserId, setMovementOperationsUserId] = useState<
    string | null
  >(null);
  const pendingMovementReady =
    movementCaptureEnabled &&
    movementOperationsUserId !== null &&
    movementOperationsUserId === boot.userId;

  const {
    data: views,
    isLoading: viewsLoading,
    isError: viewsError,
    isSuccess: viewsSucceeded,
    failureCount: viewsFailureCount,
  } = useQuery(trpc.view.getAll.queryOptions());

  const serverViews = views?.some((view) => view.id === LOCAL_ALL_LISTS_VIEW_ID)
    ? undefined
    : views;
  const serverEffectiveViews = views ?? boot.localViews;
  const effectiveViews =
    movementCaptureEnabled && pendingMovementReady && serverEffectiveViews
      ? applyPendingViewOverlay(
          serverEffectiveViews,
          relinquishConfirmedOperations(pendingMovementOperations, {
            views: views ?? null,
          }),
        )
      : serverEffectiveViews;
  const allListsView = effectiveViews?.find((view) => view.type === "ALL_LISTS");
  const serverAllListsView = serverViews?.find((view) => view.type === "ALL_LISTS");
  const selectedView = selectedViewFromCache(effectiveViews);
  const serverSelectedView = selectedViewFromCache(serverViews);
  const selectedViewId = selectedView?.id;

  const dashboardKeys = buildDashboardKeys(trpc, {
    allListsViewId: allListsView?.id,
    selectedViewId,
  });

  const {
    views: viewsQueryKey,
    allLists: allListsQueryKey,
    currentView: currentViewQueryKey,
    selectedView: selectedViewQueryKey,
  } = dashboardKeys;

  const queryKey = selectedViewQueryKey;


  const optimisticSync = useOptimisticSync();

  useRenderMeasure("ListsContainer");

  const [activeDropTarget, setActiveDropTarget] = useState<{
    type: string;
    id: string;
  } | null>(null);
  const [dragPreviewLists, setDragPreviewLists] = useState<DragPreviewLists | null>(null);
  const dragPreviewListsRef = useRef<DragPreviewLists | null>(null);
  const outboxRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outboxSignatureRef = useRef<string>("");
  const { data: bootCurrentView, isLoading: bootListsLoading, isError: bootListsError } = useQuery(
    trpc.view.getCurrentViewListsWithItems.queryOptions()
  );

  const {
    data: serverAllListsSnapshot,
    isLoading: allListsLoading,
    isError: allListsError,
    isSuccess: allListsSucceeded,
  } = useQuery(
    trpc.view.getViewListsWithItems.queryOptions(
      { viewId: serverAllListsView?.id ?? EMPTY_VIEW_ID },
      { enabled: Boolean(serverAllListsView?.id) }
    )
  );

  const { data: selectedViewSnapshot, isLoading: selectedViewLoading, isError: selectedViewError } = useQuery(
    trpc.view.getViewListsWithItems.queryOptions(
      { viewId: serverSelectedView?.id ?? EMPTY_VIEW_ID },
      { enabled: Boolean(serverSelectedView?.id) }
    )
  );

  const relinquishedOperations = useMemo(
    () =>
      relinquishConfirmedOperations(pendingMovementOperations, {
        allLists: serverAllListsSnapshot ?? null,
        views: views ?? null,
      }),
    [pendingMovementOperations, serverAllListsSnapshot, views],
  );

  useEffect(() => {
    if (!movementCaptureEnabled || !boot.userId) {
      return;
    }

    let cancelled = false;

    void readActiveOutboxOperationsForUser(boot.userId)
      .then((operations) => {
        if (!cancelled) {
          outboxSignatureRef.current = outboxOperationsSignature(operations);
          setPendingMovementOperations(operations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingMovementOperations([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMovementOperationsUserId(boot.userId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boot.userId, movementCaptureEnabled]);

  useEffect(() => {
    const userId = boot.userId;
    if (!movementCaptureEnabled || !userId) {
      return;
    }

    let cancelled = false;

    const refresh = () => {
      void readActiveOutboxOperationsForUser(userId)
        .then((operations) => {
          if (cancelled) return;
          const signature = outboxOperationsSignature(operations);
          if (signature === outboxSignatureRef.current) return;
          outboxSignatureRef.current = signature;
          setPendingMovementOperations(operations);
        })
        .catch(() => {
          // The existing overlay remains authoritative if the refresh fails.
        });
    };

    const unsubscribe = subscribeToOutboxCaptures((event) => {
      if (event.userId !== userId) return;
      if (outboxRefreshTimerRef.current !== null) {
        clearTimeout(outboxRefreshTimerRef.current);
      }
      outboxRefreshTimerRef.current = setTimeout(refresh, 120);
    });

    return () => {
      cancelled = true;
      if (outboxRefreshTimerRef.current !== null) {
        clearTimeout(outboxRefreshTimerRef.current);
        outboxRefreshTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [boot.userId, movementCaptureEnabled]);

  const effectiveBootCurrentView =
    movementCaptureEnabled && pendingMovementReady && bootCurrentView
      ? applyPendingOutboxOverlay(
          bootCurrentView,
          relinquishedOperations,
        )
      : bootCurrentView;
  const effectiveSelectedViewSnapshot =
    movementCaptureEnabled && pendingMovementReady && selectedViewSnapshot
      ? applyPendingOutboxOverlay(
          selectedViewSnapshot,
          relinquishedOperations,
        )
      : selectedViewSnapshot;

  useEffect(() => {
    if (!canApplySelectedViewPayload(selectedViewId, effectiveBootCurrentView)) return;
    queryClient.setQueryData(currentViewQueryKey, effectiveBootCurrentView);
  }, [currentViewQueryKey, effectiveBootCurrentView, queryClient, selectedViewId]);

  useEffect(() => {
    if (!canApplySelectedViewPayload(selectedViewId, effectiveSelectedViewSnapshot)) return;
    queryClient.setQueryData(currentViewQueryKey, effectiveSelectedViewSnapshot);
  }, [currentViewQueryKey, effectiveSelectedViewSnapshot, queryClient, selectedViewId]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !boot.userId ||
      !views ||
      !serverAllListsSnapshot ||
      !viewsSucceeded ||
      !allListsSucceeded ||
      viewsError ||
      allListsError
    ) {
      return;
    }

    let cancelled = false;

    async function seedServerGraphIntoLocalDb() {
      try {
        if (!views || !serverAllListsSnapshot) return;
        const confirmedServerViews = views.filter(
          (view) => view.userId === boot.userId,
        );
        const confirmedServerAllLists = {
          ...serverAllListsSnapshot,
          lists: serverAllListsSnapshot.lists
            .filter((list) => !isOptimisticCacheRow(list))
            .map((list) => ({
              ...list,
              listItems: list.listItems.filter(
                (item) => !isOptimisticCacheRow(item),
              ),
            })),
        };
        const [
          localViews,
          localLists,
          localListItems,
          localTags,
          localListTags,
          localViewLists,
          localViewTags,
        ] = await Promise.all([
          listLocalViewsForUser(boot.userId!),
          listLocalListsForUser(boot.userId!),
          listLocalListItemsForUser(boot.userId!),
          listLocalTagsForUser(boot.userId!),
          listLocalListTagsForUser(boot.userId!),
          listLocalViewListsForUser(boot.userId!),
          listLocalViewTagsForUser(boot.userId!),
        ]);

        if (cancelled) return;

        const plan = reconcileServerGraphIntoLocalPlan({
          userId: boot.userId!,
          server: {
            views: confirmedServerViews,
            allLists: confirmedServerAllLists,
          },
          local: {
            views: localViews,
            lists: localLists,
            listItems: localListItems,
            tags: localTags,
            listTags: localListTags,
            viewLists: localViewLists,
            viewTags: localViewTags,
          },
        });

        await applyLocalGraphReconcilePlan(plan);
      } catch {
        // Local seeding must never disrupt the online server-backed dashboard.
      }
    }

    void seedServerGraphIntoLocalDb();

    return () => {
      cancelled = true;
    };
  }, [
    allListsError,
    allListsSucceeded,
    boot.userId,
    serverAllListsSnapshot,
    views,
    viewsError,
    viewsSucceeded,
  ]);

  // Confirmed API-unavailable, NOT ordinary loading: at least one server views fetch has
  // failed (failureCount increments on the first failed attempt, before retry exhaustion)
  // and there is no server data. Inert online: a successful fetch keeps failureCount at 0
  // with `views` defined, and ordinary first-load loading has failureCount 0.
  const apiUnavailable = (viewsError || viewsFailureCount > 0) && !views;
  const usingLocalFallback = apiUnavailable && boot.localBootReady;

  const currentView = resolveDashboardCurrentView({
    selectedViewId,
    selectedViewSnapshot: effectiveSelectedViewSnapshot,
    bootCurrentView: effectiveBootCurrentView,
    localCurrentView: usingLocalFallback ? boot.localCurrentView : undefined,
    previousCurrentView: undefined,
  });

  const lists = currentView?.lists ?? [];
  const visibleLists = dragPreviewLists ?? lists;

  const reorderListsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reorderListItemsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingItemMovementBaseRef = useRef<Lists | null>(null);

  const refreshPendingMovementOperations = useCallback(async () => {
    if (!boot.userId) return;

    try {
      setPendingMovementOperations(
        await readPendingOutboxOperationsForUser(boot.userId),
      );
      setMovementOperationsUserId(boot.userId);
    } catch {
      // The committed cache placement remains authoritative for this render.
    }
  }, [boot.userId]);

  const writeListOrderToCaches = useCallback((nextLists: Lists) => {
    if (currentView?.view.type === "ALL_LISTS") {
      measureCacheWrite("lists.drop.all-lists", nextLists);
      queryClient.setQueryData<CurrentView>(queryKey, (current) =>
        current ? { ...current, lists: nextLists } : current
      );
      queryClient.setQueryData<CurrentView>(currentViewQueryKey, (current) =>
        current ? { ...current, lists: nextLists } : current
      );
    } else {
      measureCacheWrite("lists.drop.view-order", nextLists.map((list, index) => ({
        listId: list.id,
        order: index,
      })));
      queryClient.setQueryData<ViewsCache>(viewsQueryKey, (currentViews) =>
        currentViews?.map((view) =>
          view.id === currentView?.view.id
            ? {
              ...view,
              viewLists: nextLists.map((list, index) => ({
                listId: list.id,
                order: index,
              })),
            }
            : view
        )
      );
      queryClient.setQueryData<CurrentView>(queryKey, (current) =>
        current ? { ...current, lists: nextLists } : current
      );
      queryClient.setQueryData<CurrentView>(currentViewQueryKey, (current) =>
        current ? { ...current, lists: nextLists } : current
      );
    }
  }, [currentView?.view.id, currentView?.view.type, currentViewQueryKey, queryClient, queryKey, viewsQueryKey]);

  const scheduleReorderListsSave = useCallback(async (nextLists: Lists) => {
    if (!boot.userId) return;

    await Promise.all([
      queryClient.cancelQueries({ queryKey }),
      queryClient.cancelQueries({ queryKey: currentViewQueryKey }),
      queryClient.cancelQueries({ queryKey: viewsQueryKey }),
    ]);

    writeListOrderToCaches(nextLists);

    if (reorderListsTimeoutRef.current) {
      clearTimeout(reorderListsTimeoutRef.current);
    }

    reorderListsTimeoutRef.current = setTimeout(() => {
      optimisticSync.replacePending("list-order", async () => {
        if (!currentView || !boot.userId) return;

        try {
          await commitLocalListReorder({
            userId: boot.userId,
            viewId: currentView.view.id,
            orderedListIds: nextLists.map((list) => list.id),
          });
          await refreshPendingMovementOperations();
        } catch {
          // Local persistence must not replace the committed cache placement.
        }
        writeListOrderToCaches(nextLists);
      }, { label: "view.reorderViewLists" });
    }, 300);
  }, [
    queryKey,
    currentViewQueryKey,
    currentView,
    boot.userId,
    optimisticSync,
    queryClient,
    refreshPendingMovementOperations,
    writeListOrderToCaches,
    viewsQueryKey,
  ]);

  const writeListItemOrderToCaches = useCallback((nextLists: Lists) => {
    measureCacheWrite("items.drop.all-lists", nextLists);
    const mergeChangedLists = (current: DashboardSnapshot | undefined) =>
      current
        ? {
          ...current,
          lists: current.lists.map((list) =>
            nextLists.find((nextList) => nextList.id === list.id) ?? list
          ),
        }
        : current;

    queryClient.setQueryData<CurrentView>(allListsQueryKey, mergeChangedLists);
    queryClient.setQueryData<CurrentView>(queryKey, mergeChangedLists);
    queryClient.setQueryData<CurrentView>(currentViewQueryKey, mergeChangedLists);
  }, [allListsQueryKey, currentViewQueryKey, queryClient, queryKey]);

  const scheduleReorderListItemsSave = useCallback(async (
    previousLists: Lists,
    nextLists: Lists,
  ) => {
    if (!boot.userId) return;

    await Promise.all([
      queryClient.cancelQueries({ queryKey: allListsQueryKey }),
      queryClient.cancelQueries({ queryKey }),
      queryClient.cancelQueries({ queryKey: currentViewQueryKey }),
    ]);

    writeListItemOrderToCaches(nextLists);
    pendingItemMovementBaseRef.current ??= previousLists;

    if (reorderListItemsTimeoutRef.current) {
      clearTimeout(reorderListItemsTimeoutRef.current);
    }

    reorderListItemsTimeoutRef.current = setTimeout(() => {
      const movementBase =
        pendingItemMovementBaseRef.current ?? previousLists;
      pendingItemMovementBaseRef.current = null;

      optimisticSync.replacePending("item-order", async () => {
        if (!boot.userId) return;

        const intents = translateListItemMovement(
          movementBase,
          nextLists,
        );

        try {
          for (const intent of intents) {
            if (intent.type === "move") {
              await commitLocalListItemMove({
                userId: boot.userId,
                itemId: intent.itemId,
                toListId: intent.toListId,
                order: intent.order,
              });
              continue;
            }

            await commitLocalListItemReorder({
              userId: boot.userId,
              listId: intent.listId,
              orderedItemIds: intent.orderedItemIds,
            });
          }
          await refreshPendingMovementOperations();
        } catch {
          // Local persistence must not replace the committed cache placement.
        }
        writeListItemOrderToCaches(nextLists);
      }, { label: "listItem.reorderListItems" });
    }, 300);
  }, [
    queryKey,
    allListsQueryKey,
    currentViewQueryKey,
    boot.userId,
    optimisticSync,
    queryClient,
    refreshPendingMovementOperations,
    writeListItemOrderToCaches,
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

  if (
    (
      viewsLoading ||
      !allListsView ||
      bootListsLoading ||
      allListsLoading ||
      selectedViewLoading ||
      (movementCaptureEnabled && !pendingMovementReady)
    ) &&
    !usingLocalFallback
  ) {
    return <div className="grow grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
      <ListSkeleton />
    </div>;
  }


  if ((viewsError || bootListsError || allListsError || selectedViewError) && !usingLocalFallback) {
    return <>Something went wrong...</>;
  }

  if (visibleLists.length === 0) {
    return <div className='w-full h-full'>
      <ListEmpty boot={boot} />
    </div>;
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        // Keep drag order local so hovering does not rewrite the whole cache.
        measureOptimisticEvent("drag.start", { lists: lists.length });
        setLocalDragPreview(lists);
      }}

      onDragEnd={(e) => {
        setActiveDropTarget(null);

        const { source, target } = e.operation;
        let finalPreview = dragPreviewListsRef.current;

        setLocalDragPreview(null);

        if (e.canceled) {
          // Cancelled drags should leave cache and server data untouched.
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
          finalPreview = reorderListsForDrag(lists, sourceListId, targetListId) ?? finalPreview;
        }

        // Only save the final dropped order. Older drag positions do not matter.
        switch (source.type) {
          case "list":
            if (!listOrderMatches(finalPreview, lists)) {
              void scheduleReorderListsSave(finalPreview);
            }
            break;

          case "list-item":
            if (!itemPlacementMatches(finalPreview, lists)) {
              void scheduleReorderListItemsSave(lists, finalPreview);
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
                dashboardKeys={dashboardKeys}
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
                      dashboardKeys={dashboardKeys}
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
