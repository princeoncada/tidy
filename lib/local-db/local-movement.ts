import {
  buildPersistedItemOrderPayload,
  type DashboardSnapshot,
} from "@/lib/dashboard-cache";
import type { LocalOutboxOperation } from "./outbox-schema";

export type LocalListItemMovementIntent =
  | {
      type: "move";
      itemId: string;
      toListId: string;
      order: number;
    }
  | {
      type: "reorder";
      listId: string;
      orderedItemIds: string[];
    };

type MovementPayload = Record<string, unknown>;

function isMovementPayload(value: unknown): value is MovementPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function orderedIdsForList(
  placements: ReturnType<typeof buildPersistedItemOrderPayload>,
  listId: string,
): string[] {
  return placements
    .filter((placement) => placement.listId === listId)
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    )
    .map((placement) => placement.id);
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function translateListItemMovement(
  previousLists: DashboardSnapshot["lists"],
  nextLists: DashboardSnapshot["lists"],
): LocalListItemMovementIntent[] {
  const previousPlacements = buildPersistedItemOrderPayload(previousLists);
  const nextPlacements = buildPersistedItemOrderPayload(nextLists);
  const previousByItemId = new Map(
    previousPlacements.map((placement) => [placement.id, placement]),
  );
  const movedPlacements = nextPlacements
    .filter((placement) => {
      const previous = previousByItemId.get(placement.id);
      return previous && previous.listId !== placement.listId;
    })
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    );
  const intents: LocalListItemMovementIntent[] = movedPlacements.map(
    (placement) => ({
      type: "move",
      itemId: placement.id,
      toListId: placement.listId,
      order: placement.order,
    }),
  );
  const reorderedListIds: string[] = [];

  for (const placement of movedPlacements) {
    const previous = previousByItemId.get(placement.id);
    if (!previous) continue;

    for (const listId of [placement.listId, previous.listId]) {
      if (reorderedListIds.includes(listId)) continue;
      reorderedListIds.push(listId);
    }
  }

  const allListIds = new Set([
    ...previousPlacements.map((placement) => placement.listId),
    ...nextPlacements.map((placement) => placement.listId),
  ]);

  for (const listId of allListIds) {
    const previousIds = orderedIdsForList(previousPlacements, listId);
    const nextIds = orderedIdsForList(nextPlacements, listId);

    if (
      !arraysEqual(previousIds, nextIds) &&
      !reorderedListIds.includes(listId)
    ) {
      reorderedListIds.push(listId);
    }
  }

  for (const listId of reorderedListIds) {
    intents.push({
      type: "reorder",
      listId,
      orderedItemIds: orderedIdsForList(nextPlacements, listId),
    });
  }

  return intents;
}

function sortByPendingOrder<T extends { id: string; order: number }>(
  rows: T[],
  orderedIds: string[],
): T[] {
  const pendingOrder = new Map(
    orderedIds.map((id, index) => [id, index]),
  );

  return [...rows].sort((left, right) => {
    const leftPendingOrder = pendingOrder.get(left.id);
    const rightPendingOrder = pendingOrder.get(right.id);

    if (leftPendingOrder !== undefined && rightPendingOrder !== undefined) {
      return leftPendingOrder - rightPendingOrder;
    }
    if (leftPendingOrder !== undefined) return -1;
    if (rightPendingOrder !== undefined) return 1;
    return left.order - right.order || left.id.localeCompare(right.id);
  });
}

export function applyPendingMovementOverlay(
  snapshot: DashboardSnapshot,
  pendingMovementOperations: readonly LocalOutboxOperation[],
): DashboardSnapshot {
  let lists = snapshot.lists.map((list) => ({
    ...list,
    listItems: [...list.listItems],
  }));

  for (const operation of pendingMovementOperations) {
    if (!isMovementPayload(operation.payload)) continue;

    if (
      operation.entityType === "viewList" &&
      operation.operationType === "reorder"
    ) {
      const viewId = getString(operation.payload.viewId);
      const orderedIds = getStringArray(operation.payload.orderedIds);

      if (viewId !== snapshot.view.id || !orderedIds) continue;

      lists = sortByPendingOrder(lists, orderedIds).map((list, order) => ({
        ...list,
        order,
      }));
      continue;
    }

    if (
      operation.entityType !== "listItem" ||
      (operation.operationType !== "move" &&
        operation.operationType !== "reorder")
    ) {
      continue;
    }

    if (operation.operationType === "move") {
      const toListId = getString(operation.payload.toListClientId);
      const order = getInteger(operation.payload.order);
      if (!toListId || order === null) continue;

      let movedItem: DashboardSnapshot["lists"][number]["listItems"][number] | undefined;
      lists = lists.map((list) => {
        const item = list.listItems.find(
          (candidate) => candidate.id === operation.entityClientId,
        );
        if (item) movedItem = item;

        return item
          ? {
              ...list,
              listItems: list.listItems.filter(
                (candidate) => candidate.id !== operation.entityClientId,
              ),
            }
          : list;
      });

      if (movedItem) {
        lists = lists.map((list) =>
          list.id === toListId
            ? {
                ...list,
                listItems: [
                  ...list.listItems,
                  { ...movedItem!, listId: toListId, order },
                ],
              }
            : list,
        );
      }
      continue;
    }

    const listId = getString(operation.payload.listId);
    const orderedIds = getStringArray(operation.payload.orderedIds);
    if (!listId || !orderedIds) continue;

    lists = lists.map((list) =>
      list.id === listId
        ? {
            ...list,
            listItems: sortByPendingOrder(
              list.listItems.map((item) => ({ ...item, listId })),
              orderedIds,
            ).map((item, order) => ({ ...item, order })),
          }
        : list,
    );
  }

  const placementChanged =
    snapshot.lists.length !== lists.length ||
    snapshot.lists.some((list, listIndex) => {
      const nextList = lists[listIndex];
      return (
        !nextList ||
        list.id !== nextList.id ||
        list.order !== nextList.order ||
        list.listItems.length !== nextList.listItems.length ||
        list.listItems.some((item, itemIndex) => {
          const nextItem = nextList.listItems[itemIndex];
          return (
            !nextItem ||
            item.id !== nextItem.id ||
            item.listId !== nextItem.listId ||
            item.order !== nextItem.order
          );
        })
      );
    });

  return placementChanged ? { ...snapshot, lists } : snapshot;
}
