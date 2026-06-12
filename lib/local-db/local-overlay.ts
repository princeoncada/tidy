import type {
  DashboardSnapshot,
  ViewsCache,
} from "@/lib/dashboard-cache";
import { applyPendingMovementOverlay } from "./local-movement";
import { getLocalDbOrThrow } from "./local-repositories";
import type { LocalTagColor } from "./local-schema";
import type { LocalOutboxOperation } from "./outbox-schema";
import type { TidyLocalDatabase } from "./tidy-db";

type OverlayPayload = Record<string, unknown>;
type DashboardTag = DashboardSnapshot["lists"][number]["listTags"][number]["tag"];
type ViewTag = ViewsCache[number]["viewTags"][number];
type OptimisticDashboardList = DashboardSnapshot["lists"][number] & {
  isOptimistic: true;
};
type OptimisticDashboardItem =
  DashboardSnapshot["lists"][number]["listItems"][number] & {
    isOptimistic: true;
  };

const PENDING_OUTBOX_STATUSES = new Set(["pending", "syncing", "failed"]);
const TAG_COLORS = new Set<LocalTagColor>([
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);

function isOverlayPayload(value: unknown): value is OverlayPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function getTagColor(value: unknown): LocalTagColor | null {
  return typeof value === "string" && TAG_COLORS.has(value as LocalTagColor)
    ? (value as LocalTagColor)
    : null;
}

function getMatchMode(value: unknown): "ALL" | "ANY" | null {
  return value === "ALL" || value === "ANY" ? value : null;
}

function isMovementOperation(operation: LocalOutboxOperation): boolean {
  return (
    (operation.entityType === "viewList" &&
      operation.operationType === "reorder") ||
    (operation.entityType === "listItem" &&
      (operation.operationType === "move" ||
        operation.operationType === "reorder"))
  );
}

function cloneTag(tag: DashboardTag): DashboardTag {
  return { ...tag };
}

function synthesizeTag(tagId: string, now: Date): DashboardTag {
  return {
    id: tagId,
    name: tagId,
    color: "gray",
    userId: "optimistic",
    createdAt: now,
    updatedAt: now,
  };
}

function findListTagMetadata(
  snapshot: DashboardSnapshot,
  tagId: string,
): DashboardTag | undefined {
  for (const list of snapshot.lists) {
    const listTag = list.listTags.find((candidate) => candidate.tagId === tagId);
    if (listTag) return cloneTag(listTag.tag);
  }

  return undefined;
}

function findViewTagMetadata(
  views: ViewsCache,
  tagId: string,
): DashboardTag | undefined {
  for (const view of views) {
    const viewTag = view.viewTags.find((candidate) => candidate.tagId === tagId);
    if (viewTag) return cloneTag(viewTag.tag);
  }

  return undefined;
}

function buildViewTags(
  viewId: string,
  tagIds: string[],
  views: ViewsCache,
  now: Date,
): ViewTag[] {
  return tagIds.map((tagId) => ({
    viewId,
    tagId,
    tag: findViewTagMetadata(views, tagId) ?? synthesizeTag(tagId, now),
  }));
}

export async function readPendingOutboxOperationsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalOutboxOperation[]> {
  const operations = await db.outboxOperations
    .where("userId")
    .equals(userId)
    .sortBy("createdAt");

  return operations.filter((operation) =>
    PENDING_OUTBOX_STATUSES.has(operation.status),
  );
}

export function applyPendingOutboxOverlay(
  snapshot: DashboardSnapshot,
  operations: readonly LocalOutboxOperation[],
): DashboardSnapshot {
  const now = new Date();
  let result: DashboardSnapshot = {
    ...snapshot,
    lists: snapshot.lists.map((list) => ({
      ...list,
      listItems: list.listItems.map((item) => ({ ...item })),
      listTags: list.listTags.map((listTag) => ({
        ...listTag,
        tag: cloneTag(listTag.tag),
      })),
    })),
  };
  const movementOperations: LocalOutboxOperation[] = [];

  for (const operation of operations) {
    if (isMovementOperation(operation)) {
      movementOperations.push(operation);
      continue;
    }
    if (!isOverlayPayload(operation.payload)) continue;

    if (operation.entityType === "list") {
      if (operation.operationType === "create") {
        const name = getString(operation.payload.name);
        if (!name) continue;
        if (result.lists.some((list) => list.id === operation.entityClientId)) {
          continue;
        }

        const order =
          result.lists.length > 0
            ? Math.min(...result.lists.map((list) => list.order)) - 1
            : 0;
        const optimisticList: OptimisticDashboardList = {
          id: operation.entityClientId,
          name,
          userId: "optimistic",
          listItems: [],
          listTags: [],
          order,
          isOptimistic: true,
          createdAt: now,
          updatedAt: now,
        };
        result = {
          ...result,
          lists: [optimisticList, ...result.lists],
        };
        continue;
      }

      if (operation.operationType === "update") {
        const name = getString(operation.payload.name);
        if (!name) continue;

        result = {
          ...result,
          lists: result.lists.map((list) =>
            list.id === operation.entityClientId ? { ...list, name } : list,
          ),
        };
        continue;
      }

      if (operation.operationType === "delete") {
        result = {
          ...result,
          lists: result.lists.filter(
            (list) => list.id !== operation.entityClientId,
          ),
        };
      }
      continue;
    }

    if (operation.entityType === "listItem") {
      if (operation.operationType === "create") {
        const name = getString(operation.payload.name);
        const listId = getString(operation.payload.listId);
        const order = getInteger(operation.payload.order);
        if (!name || !listId || order === null) continue;
        if (
          result.lists.some((list) =>
            list.listItems.some(
              (item) => item.id === operation.entityClientId,
            ),
          )
        ) {
          continue;
        }

        const optimisticItem: OptimisticDashboardItem = {
          id: operation.entityClientId,
          name,
          completed: false,
          notes: null,
          listId,
          order,
          createdAt: now,
          updatedAt: now,
          isOptimistic: true,
        };
        result = {
          ...result,
          lists: result.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  listItems: [optimisticItem, ...list.listItems],
                }
              : list,
          ),
        };
        continue;
      }

      if (operation.operationType === "update") {
        const name = getString(operation.payload.name);
        const completed = getBoolean(operation.payload.completed);
        if (name === null && completed === null) continue;

        result = {
          ...result,
          lists: result.lists.map((list) => ({
            ...list,
            listItems: list.listItems.map((item) =>
              item.id === operation.entityClientId
                ? {
                    ...item,
                    ...(name !== null ? { name } : {}),
                    ...(completed !== null ? { completed } : {}),
                  }
                : item,
            ),
          })),
        };
        continue;
      }

      if (operation.operationType === "delete") {
        result = {
          ...result,
          lists: result.lists.map((list) => ({
            ...list,
            listItems: list.listItems.filter(
              (item) => item.id !== operation.entityClientId,
            ),
          })),
        };
      }
      continue;
    }

    if (operation.entityType === "listTag") {
      const listId = getString(operation.payload.listId);
      const tagId = getString(operation.payload.tagId);
      if (!listId || !tagId) continue;

      if (operation.operationType === "attach") {
        const tag =
          findListTagMetadata(result, tagId) ?? synthesizeTag(tagId, now);
        result = {
          ...result,
          lists: result.lists.map((list) => {
            if (
              list.id !== listId ||
              list.listTags.some((listTag) => listTag.tagId === tagId)
            ) {
              return list;
            }

            return {
              ...list,
              listTags: [...list.listTags, { listId, tagId, tag }],
            };
          }),
        };
        continue;
      }

      if (operation.operationType === "detach") {
        result = {
          ...result,
          lists: result.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  listTags: list.listTags.filter(
                    (listTag) => listTag.tagId !== tagId,
                  ),
                }
              : list,
          ),
        };
      }
      continue;
    }

    if (operation.entityType === "tag") {
      if (operation.operationType === "update") {
        const name = getString(operation.payload.name);
        const color = getTagColor(operation.payload.color);
        if (name === null && color === null) continue;

        result = {
          ...result,
          lists: result.lists.map((list) => ({
            ...list,
            listTags: list.listTags.map((listTag) =>
              listTag.tagId === operation.entityClientId
                ? {
                    ...listTag,
                    tag: {
                      ...listTag.tag,
                      ...(name !== null ? { name } : {}),
                      ...(color !== null ? { color } : {}),
                    },
                  }
                : listTag,
            ),
          })),
        };
        continue;
      }

      if (operation.operationType === "delete") {
        result = {
          ...result,
          lists: result.lists.map((list) => ({
            ...list,
            listTags: list.listTags.filter(
              (listTag) => listTag.tagId !== operation.entityClientId,
            ),
          })),
        };
      }
    }
  }

  return applyPendingMovementOverlay(result, movementOperations);
}

export function applyPendingViewOverlay(
  views: ViewsCache,
  operations: readonly LocalOutboxOperation[],
): ViewsCache {
  const now = new Date();
  let result: ViewsCache = views.map((view) => ({
    ...view,
    viewTags: view.viewTags.map((viewTag) => ({
      ...viewTag,
      tag: cloneTag(viewTag.tag),
    })),
    viewLists: view.viewLists.map((viewList) => ({ ...viewList })),
  }));

  for (const operation of operations) {
    if (!isOverlayPayload(operation.payload)) continue;

    if (
      operation.entityType === "metadata" &&
      operation.entityClientId === "selected-view" &&
      operation.operationType === "update"
    ) {
      const selectedViewId = getString(operation.payload.selectedViewId);
      if (!selectedViewId) continue;

      result = result.map((view) => ({
        ...view,
        isDefault: view.id === selectedViewId,
      }));
      continue;
    }

    if (operation.entityType !== "view") continue;

    if (operation.operationType === "create") {
      const name = getString(operation.payload.name);
      const tagIds = getStringArray(operation.payload.tagIds);
      const matchMode =
        operation.payload.matchMode === undefined
          ? "ALL"
          : getMatchMode(operation.payload.matchMode);
      if (!name || !tagIds || !matchMode) continue;
      if (result.some((view) => view.id === operation.entityClientId)) continue;

      const order =
        result.length > 0
          ? Math.min(...result.map((view) => view.order)) - 1
          : 0;
      result = [
        {
          id: operation.entityClientId,
          userId: "optimistic",
          name,
          type: "CUSTOM",
          isDefault: false,
          matchMode,
          order,
          createdAt: now,
          updatedAt: now,
          viewTags: buildViewTags(
            operation.entityClientId,
            tagIds,
            result,
            now,
          ),
          viewLists: [],
        },
        ...result,
      ];
      continue;
    }

    if (operation.operationType === "update") {
      const name = getString(operation.payload.name);
      const tagIds =
        operation.payload.tagIds === undefined
          ? null
          : getStringArray(operation.payload.tagIds);
      const matchMode = getMatchMode(operation.payload.matchMode);
      if (
        name === null &&
        tagIds === null &&
        matchMode === null
      ) {
        continue;
      }

      result = result.map((view) =>
        view.id === operation.entityClientId
          ? {
              ...view,
              ...(name !== null ? { name } : {}),
              ...(tagIds !== null
                ? {
                    viewTags: buildViewTags(
                      view.id,
                      tagIds,
                      result,
                      now,
                    ),
                  }
                : {}),
              ...(matchMode !== null ? { matchMode } : {}),
            }
          : view,
      );
      continue;
    }

    if (operation.operationType === "delete") {
      result = result.filter((view) => view.id !== operation.entityClientId);
      continue;
    }

    if (operation.operationType === "reorder") {
      const orderedIds = getStringArray(operation.payload.orderedIds);
      if (!orderedIds) continue;

      const pendingOrder = new Map(
        orderedIds.map((viewId, index) => [viewId, index]),
      );
      const customViews = result
        .filter((view) => view.type === "CUSTOM")
        .map((view, stableIndex) => ({ view, stableIndex }))
        .sort((left, right) => {
          const leftOrder = pendingOrder.get(left.view.id);
          const rightOrder = pendingOrder.get(right.view.id);

          if (leftOrder !== undefined && rightOrder !== undefined) {
            return leftOrder - rightOrder;
          }
          if (leftOrder !== undefined) return -1;
          if (rightOrder !== undefined) return 1;
          return left.stableIndex - right.stableIndex;
        })
        .map(({ view }, order) => ({ ...view, order }));
      const fixedViews = result.filter((view) => view.type !== "CUSTOM");

      result = [...fixedViews, ...customViews].sort(
        (left, right) =>
          left.order - right.order || left.id.localeCompare(right.id),
      );
    }
  }

  return result;
}
