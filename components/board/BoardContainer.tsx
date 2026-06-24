"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { BoardColumn } from "@/components/board/BoardColumn";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import type { LocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";
import { useReplicacheDashboard } from "@/hooks/useReplicacheDashboard";
import {
  BOARD_COLUMNS,
  boardKeyForDrop,
  groupItemsByStatus,
  type BoardCardItem,
} from "@/lib/board/board-order";
import { filterListsByWorkspace } from "@/lib/dashboard/workspace-filter";
import type { ItemStatus } from "@/lib/sync/replicache/keys";

type BoardContainerProps = {
  boot: LocalFirstDashboardBoot;
  activeWorkspaceId: string | null;
};

type BoardGroups = Record<ItemStatus, BoardCardItem[]>;

function statusFromColumnId(id: string): ItemStatus | null {
  const status = id.replace("board-column-", "");
  return BOARD_COLUMNS.some((column) => column.status === status)
    ? (status as ItemStatus)
    : null;
}

function findItemPlacement(groups: BoardGroups, itemId: string) {
  for (const column of BOARD_COLUMNS) {
    const index = groups[column.status].findIndex((item) => item.id === itemId);
    if (index >= 0) {
      return { status: column.status, index };
    }
  }
  return null;
}

function moveBoardItemForDrag(
  groups: BoardGroups,
  draggedItemId: string,
  targetType: string,
  targetId: string,
): BoardGroups | null {
  const source = findItemPlacement(groups, draggedItemId);
  if (!source) return null;

  let targetStatus: ItemStatus | null = null;
  let targetIndex = 0;

  if (targetType === "board-column") {
    targetStatus = statusFromColumnId(targetId);
    if (!targetStatus) return null;
    targetIndex = groups[targetStatus].length;
  }

  if (targetType === "board-card") {
    const targetItemId = targetId.replace("board-card-", "");
    const target = findItemPlacement(groups, targetItemId);
    if (!target) return null;
    targetStatus = target.status;
    targetIndex = target.index;
  }

  if (!targetStatus) return null;

  if (source.status === targetStatus && source.index === targetIndex) {
    return null;
  }

  const nextGroups: BoardGroups = {
    TODO: [...groups.TODO],
    IN_PROGRESS: [...groups.IN_PROGRESS],
    DONE: [...groups.DONE],
  };
  const [movedItem] = nextGroups[source.status].splice(source.index, 1);
  let insertIndex = targetIndex;

  if (source.status === targetStatus && source.index < targetIndex) {
    insertIndex -= 1;
  }

  nextGroups[targetStatus].splice(insertIndex, 0, {
    ...movedItem,
    status: targetStatus,
  });

  return nextGroups;
}

function placementChanged(
  before: BoardGroups,
  after: BoardGroups,
  itemId: string,
) {
  const beforePlacement = findItemPlacement(before, itemId);
  const afterPlacement = findItemPlacement(after, itemId);

  return (
    beforePlacement?.status !== afterPlacement?.status ||
    beforePlacement?.index !== afterPlacement?.index
  );
}

export default function BoardContainer({
  boot,
  activeWorkspaceId,
}: BoardContainerProps) {
  const dashboard = useReplicacheDashboard();
  const { mutate } = useDashboardMutations();
  const [activeDropTarget, setActiveDropTarget] = useState<{
    type: string;
    id: string;
  } | null>(null);
  const [dragPreviewGroups, setDragPreviewGroups] =
    useState<BoardGroups | null>(null);
  const dragPreviewGroupsRef = useRef<BoardGroups | null>(null);

  const boardData = useMemo(() => {
    const lists = filterListsByWorkspace(
      dashboard.currentView?.lists ?? [],
      activeWorkspaceId,
    );
    const listIds = new Set(lists.map((list) => list.id));
    const listNames = new Map(lists.map((list) => [list.id, list.name]));
    const editableLists = new Set(
      lists
        .filter((list) => {
          const role =
            list.accessRole ??
            (list.userId === boot.userId ? "OWNER" : "VIEWER");
          return role === "OWNER" || role === "EDITOR";
        })
        .map((list) => list.id),
    );
    const items = dashboard.listItemValues.filter((item) =>
      listIds.has(item.listId)
    );

    return {
      lists,
      listNames,
      editableLists,
      groups: groupItemsByStatus(items),
    };
  }, [
    activeWorkspaceId,
    boot.userId,
    dashboard.currentView?.lists,
    dashboard.listItemValues,
  ]);

  const visibleGroups = dragPreviewGroups ?? boardData.groups;
  const setLocalDragPreview = useCallback((nextGroups: BoardGroups | null) => {
    dragPreviewGroupsRef.current = nextGroups;
    setDragPreviewGroups(nextGroups);
  }, []);
  const canEditItem = useCallback(
    (item: BoardCardItem) => boardData.editableLists.has(item.listId),
    [boardData.editableLists],
  );

  if (!dashboard.ready) {
    return (
      <div className="grid grow grid-cols-1 gap-3 lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => (
          <div
            key={column.status}
            className="min-h-80 animate-pulse rounded-lg border border-border bg-surface-muted"
          />
        ))}
      </div>
    );
  }

  if (boardData.lists.length === 0) {
    return (
      <div className="flex min-h-80 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
        No lists in this workspace
      </div>
    );
  }

  const itemCount = BOARD_COLUMNS.reduce(
    (count, column) => count + boardData.groups[column.status].length,
    0,
  );

  if (itemCount === 0) {
    return (
      <div className="flex min-h-80 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
        No items in this view
      </div>
    );
  }

  return (
    <DragDropProvider
      onDragStart={(event) => {
        const source = event.operation.source;
        if (!source || source.type !== "board-card") return;

        const itemId = String(source.id).replace("board-card-", "");
        const item = dashboard.listItemValues.find(
          (entry) => entry.id === itemId,
        );
        if (!item || !boardData.editableLists.has(item.listId)) return;

        setLocalDragPreview(boardData.groups);
      }}
      onDragOver={(event) => {
        const { source, target } = event.operation;

        if (!source || !target) {
          setActiveDropTarget(null);
          return;
        }

        setActiveDropTarget({
          type: String(target.type),
          id: String(target.id),
        });

        if (source.type !== "board-card") return;

        const draggedItemId = String(source.id).replace("board-card-", "");
        const draggedItem = dashboard.listItemValues.find(
          (item) => item.id === draggedItemId,
        );
        if (!draggedItem || !boardData.editableLists.has(draggedItem.listId)) {
          return;
        }

        const nextGroups = moveBoardItemForDrag(
          dragPreviewGroupsRef.current ?? boardData.groups,
          draggedItemId,
          String(target.type),
          String(target.id),
        );

        if (nextGroups) {
          setLocalDragPreview(nextGroups);
        }
      }}
      onDragEnd={(event) => {
        setActiveDropTarget(null);

        const { source, target } = event.operation;
        if (event.canceled || !source || source.type !== "board-card") {
          setLocalDragPreview(null);
          return;
        }

        const draggedItemId = String(source.id).replace("board-card-", "");
        const draggedItem = dashboard.listItemValues.find(
          (item) => item.id === draggedItemId,
        );
        if (!draggedItem || !boardData.editableLists.has(draggedItem.listId)) {
          setLocalDragPreview(null);
          return;
        }

        let finalGroups = dragPreviewGroupsRef.current;
        if (target) {
          finalGroups = moveBoardItemForDrag(
            boardData.groups,
            draggedItemId,
            String(target.type),
            String(target.id),
          ) ?? finalGroups;
        }

        if (
          !finalGroups ||
          !placementChanged(boardData.groups, finalGroups, draggedItemId)
        ) {
          setLocalDragPreview(null);
          return;
        }

        const finalPlacement = findItemPlacement(finalGroups, draggedItemId);
        if (!finalPlacement || !mutate) {
          setLocalDragPreview(null);
          return;
        }

        const destinationWithoutDragged = boardData.groups[
          finalPlacement.status
        ].filter((item) => item.id !== draggedItemId);
        const boardOrderKey = boardKeyForDrop(
          destinationWithoutDragged,
          finalPlacement.index,
        );

        void mutate.updateItem({
          id: draggedItemId,
          status: finalPlacement.status,
          boardOrderKey,
          now: new Date().toISOString(),
        });
        setLocalDragPreview(null);
      }}
    >
      <div className="grid grow grid-cols-1 gap-3 lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            column={column}
            items={visibleGroups[column.status]}
            listNames={boardData.listNames}
            canEditItem={canEditItem}
            activeDropTarget={activeDropTarget}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
