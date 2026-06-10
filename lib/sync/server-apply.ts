import {
  Prisma,
  type TagColor,
  type ViewMatchMode,
  ViewType,
} from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import type { LocalJsonValue, LocalOutboxOperation } from "@/lib/local-db/outbox-schema";
import type { SyncBatchOperationDecision } from "@/lib/sync/sync-batch-contract";
import {
  ensureAllListsView,
  getAffectedCustomViewIdsForTags,
  recomputeCustomViewsForIds,
  recomputeCustomViewsForTags,
  setSelectedView,
} from "@/trpc/routers/viewHelpers";

export type SyncApplyOperationResult = {
  operationId: string;
  status: "applied" | "already-applied" | "rejected";
  errorMessage: string | null;
};

type AcceptedDecision = Extract<SyncBatchOperationDecision, { accepted: true }>;
type SyncTransaction = Prisma.TransactionClient;
type ApplyStatus = SyncApplyOperationResult["status"];

type PostCommitEffects = {
  tagIds: Set<string>;
  viewIds: Set<string>;
};

const TAG_COLORS = new Set([
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);

const VIEW_MATCH_MODES = new Set(["ALL", "ANY"]);

function isRecord(value: LocalJsonValue): value is Record<string, LocalJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(
  operation: LocalOutboxOperation,
  ...keys: string[]
): string | null {
  if (!isRecord(operation.payload)) {
    return null;
  }

  for (const key of keys) {
    const value = operation.payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function hasPayloadKey(
  operation: LocalOutboxOperation,
  key: string,
): boolean {
  return isRecord(operation.payload) && key in operation.payload;
}

function getOptionalString(
  operation: LocalOutboxOperation,
  key: string,
): string | null | undefined {
  if (!isRecord(operation.payload) || !(key in operation.payload)) {
    return undefined;
  }

  const value = operation.payload[key];
  return value === null || typeof value === "string" ? value : undefined;
}

function getBoolean(
  operation: LocalOutboxOperation,
  key: string,
): boolean | undefined {
  if (!isRecord(operation.payload)) {
    return undefined;
  }

  const value = operation.payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function getInteger(
  operation: LocalOutboxOperation,
  ...keys: string[]
): number | null {
  if (!isRecord(operation.payload)) {
    return null;
  }

  for (const key of keys) {
    const value = operation.payload[key];
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }
  }

  return null;
}

function getStringArray(
  operation: LocalOutboxOperation,
  ...keys: string[]
): string[] | null {
  if (!isRecord(operation.payload)) {
    return null;
  }

  for (const key of keys) {
    const value = operation.payload[key];
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value;
    }
  }

  return null;
}

function getTagColor(operation: LocalOutboxOperation): TagColor | undefined {
  const color = getString(operation, "color");
  return color && TAG_COLORS.has(color) ? (color as TagColor) : undefined;
}

function getViewMatchMode(
  operation: LocalOutboxOperation,
): ViewMatchMode | undefined {
  const matchMode = getString(operation, "matchMode");
  return matchMode && VIEW_MATCH_MODES.has(matchMode)
    ? (matchMode as ViewMatchMode)
    : undefined;
}

function hasDuplicateIds(ids: string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function result(
  operationId: string,
  status: ApplyStatus,
  errorMessage: string | null = null,
): SyncApplyOperationResult {
  return { operationId, status, errorMessage };
}

function rejected(
  decision: AcceptedDecision,
  errorMessage: string,
): SyncApplyOperationResult {
  return result(decision.operationId, "rejected", errorMessage);
}

async function applyListOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;

  switch (operation.operationType) {
    case "create": {
      const name = getString(operation, "name");
      if (!name) {
        return rejected(decision, "List create requires payload.name.");
      }

      const existing = await tx.list.findUnique({
        where: { id: operation.entityClientId },
        select: { id: true, userId: true },
      });

      if (existing && existing.userId !== userId) {
        return rejected(decision, "List id belongs to another user.");
      }

      const allListsView = await ensureAllListsView(userId, tx);

      if (existing) {
        return result(decision.operationId, "already-applied");
      }

      const topMembership = await tx.viewList.findFirst({
        where: { viewId: allListsView.id },
        orderBy: { order: "asc" },
        select: { order: true },
      });

      await tx.list.create({
        data: {
          id: operation.entityClientId,
          name,
          userId,
        },
      });
      await tx.viewList.createMany({
        data: [{
          viewId: allListsView.id,
          listId: operation.entityClientId,
          order: topMembership ? topMembership.order - 1 : 0,
        }],
        skipDuplicates: true,
      });

      return result(decision.operationId, "applied");
    }

    case "update": {
      const name = getString(operation, "name");
      if (!name) {
        return rejected(decision, "List update requires payload.name.");
      }

      const existing = await tx.list.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true, name: true },
      });

      if (!existing) {
        return rejected(decision, "List update target was not found.");
      }
      if (existing.userId !== userId) {
        return rejected(decision, "List update target belongs to another user.");
      }
      if (existing.name === name) {
        return result(decision.operationId, "already-applied");
      }

      const update = await tx.list.updateMany({
        where: { id: operation.entityClientId, userId },
        data: { name },
      });

      return update.count > 0
        ? result(decision.operationId, "applied")
        : rejected(decision, "List update ownership check failed.");
    }

    case "delete": {
      const existing = await tx.list.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true },
      });

      if (!existing) {
        return result(decision.operationId, "already-applied");
      }
      if (existing.userId !== userId) {
        return rejected(decision, "List delete target belongs to another user.");
      }

      await tx.list.deleteMany({
        where: { id: operation.entityClientId, userId },
      });
      return result(decision.operationId, "applied");
    }

    case "reorder": {
      const orderedIds = getStringArray(operation, "orderedIds");
      if (!orderedIds || hasDuplicateIds(orderedIds)) {
        return rejected(
          decision,
          "List reorder requires unique payload.orderedIds.",
        );
      }
      if (orderedIds.length === 0) {
        return result(decision.operationId, "already-applied");
      }

      const requestedViewId = getString(
        operation,
        "viewId",
        "viewClientId",
        "targetViewClientId",
      );
      const view = requestedViewId
        ? await tx.view.findFirst({
            where: { id: requestedViewId, userId },
            select: { id: true },
          })
        : await ensureAllListsView(userId, tx);

      if (!view) {
        return rejected(decision, "List reorder view was not found for this user.");
      }

      const memberships = await tx.viewList.findMany({
        where: {
          viewId: view.id,
          listId: { in: orderedIds },
          list: { userId },
        },
        select: { listId: true, order: true },
      });

      if (memberships.length !== orderedIds.length) {
        return rejected(
          decision,
          "List reorder includes a list outside the owned target view.",
        );
      }

      const currentOrders = new Map(
        memberships.map((membership) => [membership.listId, membership.order]),
      );
      if (orderedIds.every((id, index) => currentOrders.get(id) === index)) {
        return result(decision.operationId, "already-applied");
      }

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "ViewList" AS view_list
          SET "order" = data."order"
          FROM (VALUES ${Prisma.join(
            orderedIds.map((id, index) =>
              Prisma.sql`(${view.id}::uuid, ${id}::uuid, ${index}::int)`,
            ),
          )}) AS data("viewId", "listId", "order")
          WHERE view_list."viewId" = data."viewId"
            AND view_list."listId" = data."listId"
        `,
      );

      return result(decision.operationId, "applied");
    }

    case "move":
    case "upsert":
      return rejected(
        decision,
        "No server semantics for list move/upsert.",
      );

    default:
      return rejected(
        decision,
        `No server semantics for list ${operation.operationType}.`,
      );
  }
}

async function applyListItemOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;

  switch (operation.operationType) {
    case "create": {
      const name = getString(operation, "name");
      const listId = getString(operation, "listId", "listClientId");
      if (!name || !listId) {
        return rejected(
          decision,
          "List item create requires payload.name and payload.listId.",
        );
      }

      const existing = await tx.listItem.findUnique({
        where: { id: operation.entityClientId },
        select: {
          id: true,
          parentList: { select: { userId: true } },
        },
      });
      if (existing) {
        return existing.parentList.userId === userId
          ? result(decision.operationId, "already-applied")
          : rejected(decision, "List item id belongs to another user.");
      }

      const parentList = await tx.list.findFirst({
        where: { id: listId, userId },
        select: { id: true },
      });
      if (!parentList) {
        return rejected(decision, "List item parent list was not found for this user.");
      }

      const topItem = await tx.listItem.findFirst({
        where: { listId },
        orderBy: { order: "asc" },
        select: { order: true },
      });
      const notes = getOptionalString(operation, "notes");

      await tx.listItem.create({
        data: {
          id: operation.entityClientId,
          name,
          listId,
          order: getInteger(operation, "order") ?? (topItem ? topItem.order - 1 : 0),
          completed: getBoolean(operation, "completed") ?? false,
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      return result(decision.operationId, "applied");
    }

    case "update": {
      const name = getString(operation, "name");
      const completed = getBoolean(operation, "completed");
      const notes = getOptionalString(operation, "notes");
      if (name === null && completed === undefined && notes === undefined) {
        return rejected(
          decision,
          "List item update requires name, completed, or notes.",
        );
      }

      const existing = await tx.listItem.findUnique({
        where: { id: operation.entityClientId },
        select: {
          name: true,
          completed: true,
          notes: true,
          parentList: { select: { userId: true } },
        },
      });
      if (!existing) {
        return rejected(decision, "List item update target was not found.");
      }
      if (existing.parentList.userId !== userId) {
        return rejected(decision, "List item update target belongs to another user.");
      }

      const unchanged =
        (name === null || existing.name === name) &&
        (completed === undefined || existing.completed === completed) &&
        (notes === undefined || existing.notes === notes);
      if (unchanged) {
        return result(decision.operationId, "already-applied");
      }

      const update = await tx.listItem.updateMany({
        where: {
          id: operation.entityClientId,
          parentList: { userId },
        },
        data: {
          ...(name !== null ? { name } : {}),
          ...(completed !== undefined ? { completed } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      return update.count > 0
        ? result(decision.operationId, "applied")
        : rejected(decision, "List item update ownership check failed.");
    }

    case "delete": {
      const existing = await tx.listItem.findUnique({
        where: { id: operation.entityClientId },
        select: {
          parentList: { select: { userId: true } },
        },
      });
      if (!existing) {
        return result(decision.operationId, "already-applied");
      }
      if (existing.parentList.userId !== userId) {
        return rejected(decision, "List item delete target belongs to another user.");
      }

      await tx.listItem.deleteMany({
        where: {
          id: operation.entityClientId,
          parentList: { userId },
        },
      });
      return result(decision.operationId, "applied");
    }

    case "reorder": {
      const orderedIds = getStringArray(operation, "orderedIds");
      const listId = getString(operation, "listId", "listClientId");
      if (!orderedIds || !listId || hasDuplicateIds(orderedIds)) {
        return rejected(
          decision,
          "List item reorder requires payload.listId and unique payload.orderedIds.",
        );
      }
      if (orderedIds.length === 0) {
        return result(decision.operationId, "already-applied");
      }

      const parentList = await tx.list.findFirst({
        where: { id: listId, userId },
        select: { id: true },
      });
      if (!parentList) {
        return rejected(decision, "List item reorder target list is not owned.");
      }

      const items = await tx.listItem.findMany({
        where: {
          id: { in: orderedIds },
          listId,
          parentList: { userId },
        },
        select: { id: true, listId: true, order: true },
      });
      if (items.length !== orderedIds.length) {
        return rejected(
          decision,
          "List item reorder includes an item outside the owned target list.",
        );
      }

      const currentOrders = new Map(items.map((item) => [item.id, item.order]));
      if (orderedIds.every((id, index) => currentOrders.get(id) === index)) {
        return result(decision.operationId, "already-applied");
      }

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "ListItem" AS item
          SET
            "listId" = data."listId",
            "order" = data."order"
          FROM (VALUES ${Prisma.join(
            orderedIds.map((id, index) =>
              Prisma.sql`(${id}::uuid, ${listId}::uuid, ${index}::int)`,
            ),
          )}) AS data("id", "listId", "order")
          WHERE item."id" = data."id"
        `,
      );

      return result(decision.operationId, "applied");
    }

    case "move": {
      const toListId = getString(
        operation,
        "toListClientId",
        "listId",
        "listClientId",
      );
      const order = getInteger(operation, "order", "position");
      if (!toListId || order === null) {
        return rejected(
          decision,
          "List item move requires payload.toListClientId and an integer order.",
        );
      }

      const [existing, targetList] = await Promise.all([
        tx.listItem.findUnique({
          where: { id: operation.entityClientId },
          select: {
            listId: true,
            order: true,
            parentList: { select: { userId: true } },
          },
        }),
        tx.list.findFirst({
          where: { id: toListId, userId },
          select: { id: true },
        }),
      ]);

      if (!existing) {
        return rejected(decision, "List item move target was not found.");
      }
      if (existing.parentList.userId !== userId || !targetList) {
        return rejected(
          decision,
          "List item move ownership or target-list check failed.",
        );
      }
      if (existing.listId === toListId && existing.order === order) {
        return result(decision.operationId, "already-applied");
      }

      const update = await tx.listItem.updateMany({
        where: {
          id: operation.entityClientId,
          parentList: { userId },
        },
        data: {
          listId: toListId,
          order,
        },
      });

      return update.count > 0
        ? result(decision.operationId, "applied")
        : rejected(decision, "List item move ownership check failed.");
    }

    case "upsert":
      return rejected(decision, "No server semantics for listItem upsert.");

    default:
      return rejected(
        decision,
        `No server semantics for listItem ${operation.operationType}.`,
      );
  }
}

async function applyTagOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
  effects: PostCommitEffects,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;

  switch (operation.operationType) {
    case "create": {
      const name = getString(operation, "name");
      if (!name) {
        return rejected(decision, "Tag create requires payload.name.");
      }
      if (hasPayloadKey(operation, "color") && !getTagColor(operation)) {
        return rejected(decision, "Tag create requires a valid color.");
      }

      const existing = await tx.tag.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true },
      });
      if (existing) {
        return existing.userId === userId
          ? result(decision.operationId, "already-applied")
          : rejected(decision, "Tag id belongs to another user.");
      }

      const conflictingTag = await tx.tag.findFirst({
        where: { userId, name },
        select: { id: true },
      });
      if (conflictingTag) {
        return rejected(decision, "A tag with this name already exists.");
      }

      await tx.tag.create({
        data: {
          id: operation.entityClientId,
          name,
          color: getTagColor(operation) ?? "gray",
          userId,
        },
      });
      return result(decision.operationId, "applied");
    }

    case "update": {
      const name = getString(operation, "name");
      const color = getTagColor(operation);
      if (hasPayloadKey(operation, "color") && !color) {
        return rejected(decision, "Tag update requires a valid color.");
      }
      if (!name && !color) {
        return rejected(decision, "Tag update requires name or a valid color.");
      }

      const existing = await tx.tag.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true, name: true, color: true },
      });
      if (!existing) {
        return rejected(decision, "Tag update target was not found.");
      }
      if (existing.userId !== userId) {
        return rejected(decision, "Tag update target belongs to another user.");
      }
      if (
        (!name || existing.name === name) &&
        (!color || existing.color === color)
      ) {
        return result(decision.operationId, "already-applied");
      }

      if (name) {
        const conflictingTag = await tx.tag.findFirst({
          where: {
            userId,
            name,
            id: { not: operation.entityClientId },
          },
          select: { id: true },
        });
        if (conflictingTag) {
          return rejected(decision, "A tag with this name already exists.");
        }
      }

      const update = await tx.tag.updateMany({
        where: { id: operation.entityClientId, userId },
        data: {
          ...(name ? { name } : {}),
          ...(color ? { color } : {}),
        },
      });
      return update.count > 0
        ? result(decision.operationId, "applied")
        : rejected(decision, "Tag update ownership check failed.");
    }

    case "delete": {
      const existing = await tx.tag.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true },
      });
      if (!existing) {
        return result(decision.operationId, "already-applied");
      }
      if (existing.userId !== userId) {
        return rejected(decision, "Tag delete target belongs to another user.");
      }

      const affectedViewIds = await getAffectedCustomViewIdsForTags(
        userId,
        [operation.entityClientId],
        tx,
      );
      affectedViewIds.forEach((viewId) => effects.viewIds.add(viewId));

      await tx.tag.deleteMany({
        where: { id: operation.entityClientId, userId },
      });
      return result(decision.operationId, "applied");
    }

    case "upsert":
      return rejected(decision, "No server semantics for tag upsert.");

    default:
      return rejected(
        decision,
        `No server semantics for tag ${operation.operationType}.`,
      );
  }
}

async function applyListTagOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
  effects: PostCommitEffects,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;
  if (operation.operationType !== "attach" && operation.operationType !== "detach") {
    return rejected(
      decision,
      `No server semantics for listTag ${operation.operationType}.`,
    );
  }

  const listId = getString(operation, "listId", "listClientId");
  const tagId = getString(operation, "tagId", "tagClientId");
  if (!listId || !tagId) {
    return rejected(
      decision,
      "List-tag operations require payload.listId and payload.tagId.",
    );
  }

  const [list, tag] = await Promise.all([
    tx.list.findFirst({
      where: { id: listId, userId },
      select: { id: true },
    }),
    tx.tag.findFirst({
      where: { id: tagId, userId },
      select: { id: true },
    }),
  ]);
  if (!list || !tag) {
    return rejected(
      decision,
      "List-tag ownership check failed for the list or tag.",
    );
  }

  const existing = await tx.listTag.findUnique({
    where: { listId_tagId: { listId, tagId } },
    select: { listId: true },
  });
  effects.tagIds.add(tagId);

  if (operation.operationType === "attach") {
    if (existing) {
      return result(decision.operationId, "already-applied");
    }
    await tx.listTag.upsert({
      where: { listId_tagId: { listId, tagId } },
      update: {},
      create: { listId, tagId },
    });
    return result(decision.operationId, "applied");
  }

  if (!existing) {
    return result(decision.operationId, "already-applied");
  }
  await tx.listTag.deleteMany({
    where: {
      listId,
      tagId,
      list: { userId },
      tag: { userId },
    },
  });
  return result(decision.operationId, "applied");
}

async function applyViewTagOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
  effects: PostCommitEffects,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;
  if (operation.operationType !== "attach" && operation.operationType !== "detach") {
    return rejected(
      decision,
      `No server semantics for viewTag ${operation.operationType}.`,
    );
  }

  const viewId = getString(operation, "viewId", "viewClientId");
  const tagId = getString(operation, "tagId", "tagClientId");
  if (!viewId || !tagId) {
    return rejected(
      decision,
      "View-tag operations require payload.viewId and payload.tagId.",
    );
  }

  const [view, tag] = await Promise.all([
    tx.view.findFirst({
      where: { id: viewId, userId, type: ViewType.CUSTOM },
      select: { id: true },
    }),
    tx.tag.findFirst({
      where: { id: tagId, userId },
      select: { id: true },
    }),
  ]);
  if (!view || !tag) {
    return rejected(
      decision,
      "View-tag ownership check failed for the custom view or tag.",
    );
  }

  const existing = await tx.viewTag.findUnique({
    where: { viewId_tagId: { viewId, tagId } },
    select: { viewId: true },
  });
  effects.viewIds.add(viewId);

  if (operation.operationType === "attach") {
    if (existing) {
      return result(decision.operationId, "already-applied");
    }
    await tx.viewTag.upsert({
      where: { viewId_tagId: { viewId, tagId } },
      update: {},
      create: { viewId, tagId },
    });
    return result(decision.operationId, "applied");
  }

  if (!existing) {
    return result(decision.operationId, "already-applied");
  }
  await tx.viewTag.deleteMany({
    where: {
      viewId,
      tagId,
      view: { userId },
      tag: { userId },
    },
  });
  return result(decision.operationId, "applied");
}

async function applyViewOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
  effects: PostCommitEffects,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;

  switch (operation.operationType) {
    case "create": {
      const name = getString(operation, "name");
      const tagIds = getStringArray(operation, "tagIds");
      if (
        hasPayloadKey(operation, "matchMode") &&
        !getViewMatchMode(operation)
      ) {
        return rejected(decision, "View create requires a valid matchMode.");
      }
      if (!name || !tagIds || tagIds.length === 0) {
        return rejected(
          decision,
          "View create requires payload.name and non-empty payload.tagIds.",
        );
      }

      const existing = await tx.view.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true },
      });
      if (existing) {
        return existing.userId === userId
          ? result(decision.operationId, "already-applied")
          : rejected(decision, "View id belongs to another user.");
      }

      const conflictingView = await tx.view.findFirst({
        where: { userId, name },
        select: { id: true },
      });
      if (conflictingView) {
        return rejected(decision, "A view with this name already exists.");
      }

      const uniqueTagIds = [...new Set(tagIds)];
      const ownedTags = await tx.tag.findMany({
        where: { id: { in: uniqueTagIds }, userId },
        select: { id: true },
      });
      if (ownedTags.length !== uniqueTagIds.length) {
        return rejected(decision, "View create includes a tag not owned by this user.");
      }

      await ensureAllListsView(userId, tx);
      const topView = await tx.view.findFirst({
        where: { userId },
        orderBy: { order: "asc" },
        select: { order: true },
      });
      await tx.view.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
      await tx.view.create({
        data: {
          id: operation.entityClientId,
          name,
          userId,
          order: getInteger(operation, "order") ?? (topView ? topView.order - 1 : 0),
          type: ViewType.CUSTOM,
          matchMode: getViewMatchMode(operation) ?? "ALL",
          isDefault: true,
          viewTags: {
            createMany: {
              data: uniqueTagIds.map((tagId) => ({ tagId })),
              skipDuplicates: true,
            },
          },
        },
      });
      effects.viewIds.add(operation.entityClientId);
      return result(decision.operationId, "applied");
    }

    case "update": {
      const name = getString(operation, "name");
      const tagIds = getStringArray(operation, "tagIds");
      const matchMode = getViewMatchMode(operation);
      if (hasPayloadKey(operation, "matchMode") && !matchMode) {
        return rejected(decision, "View update requires a valid matchMode.");
      }
      if (!name && tagIds === null && !matchMode) {
        return rejected(
          decision,
          "View update requires name, tagIds, or a valid matchMode.",
        );
      }

      const existing = await tx.view.findFirst({
        where: {
          id: operation.entityClientId,
          userId,
          type: ViewType.CUSTOM,
        },
        include: {
          viewTags: { select: { tagId: true } },
        },
      });
      if (!existing) {
        const anyView = await tx.view.findUnique({
          where: { id: operation.entityClientId },
          select: { userId: true, type: true },
        });
        return anyView
          ? rejected(decision, "View update target is not an owned custom view.")
          : rejected(decision, "View update target was not found.");
      }

      const uniqueTagIds = tagIds ? [...new Set(tagIds)] : null;
      if (uniqueTagIds) {
        if (uniqueTagIds.length === 0) {
          return rejected(decision, "Custom views require at least one tag.");
        }
        const ownedTags = await tx.tag.findMany({
          where: { id: { in: uniqueTagIds }, userId },
          select: { id: true },
        });
        if (ownedTags.length !== uniqueTagIds.length) {
          return rejected(decision, "View update includes a tag not owned by this user.");
        }
      }

      const currentTagIds = existing.viewTags.map((viewTag) => viewTag.tagId).sort();
      const requestedTagIds = uniqueTagIds ? [...uniqueTagIds].sort() : null;
      const unchanged =
        (!name || existing.name === name) &&
        (!matchMode || existing.matchMode === matchMode) &&
        (!requestedTagIds ||
          (requestedTagIds.length === currentTagIds.length &&
            requestedTagIds.every((id, index) => id === currentTagIds[index])));
      if (unchanged) {
        return result(decision.operationId, "already-applied");
      }

      if (name) {
        const conflictingView = await tx.view.findFirst({
          where: {
            userId,
            name,
            id: { not: operation.entityClientId },
          },
          select: { id: true },
        });
        if (conflictingView) {
          return rejected(decision, "A view with this name already exists.");
        }
      }

      if (name || matchMode) {
        await tx.view.updateMany({
          where: {
            id: operation.entityClientId,
            userId,
            type: ViewType.CUSTOM,
          },
          data: {
            ...(name ? { name } : {}),
            ...(matchMode ? { matchMode } : {}),
          },
        });
      }
      if (uniqueTagIds) {
        await tx.viewTag.deleteMany({
          where: { viewId: operation.entityClientId },
        });
        await tx.viewTag.createMany({
          data: uniqueTagIds.map((tagId) => ({
            viewId: operation.entityClientId,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      effects.viewIds.add(operation.entityClientId);
      return result(decision.operationId, "applied");
    }

    case "delete": {
      const existing = await tx.view.findUnique({
        where: { id: operation.entityClientId },
        select: { userId: true, type: true, isDefault: true },
      });
      if (!existing) {
        return result(decision.operationId, "already-applied");
      }
      if (existing.userId !== userId || existing.type !== ViewType.CUSTOM) {
        return rejected(decision, "View delete target is not an owned custom view.");
      }

      await tx.view.delete({
        where: { id: operation.entityClientId },
      });
      if (existing.isDefault) {
        const allListsView = await ensureAllListsView(userId, tx);
        await setSelectedView(userId, allListsView.id, tx);
      }
      return result(decision.operationId, "applied");
    }

    case "reorder": {
      const orderedIds = getStringArray(operation, "orderedIds");
      if (!orderedIds || hasDuplicateIds(orderedIds)) {
        return rejected(
          decision,
          "View reorder requires unique payload.orderedIds.",
        );
      }
      if (orderedIds.length === 0) {
        return result(decision.operationId, "already-applied");
      }

      const views = await tx.view.findMany({
        where: {
          id: { in: orderedIds },
          userId,
          type: ViewType.CUSTOM,
        },
        select: { id: true, order: true },
      });
      if (views.length !== orderedIds.length) {
        return rejected(decision, "View reorder includes a non-owned custom view.");
      }

      const currentOrders = new Map(views.map((view) => [view.id, view.order]));
      if (orderedIds.every((id, index) => currentOrders.get(id) === index)) {
        return result(decision.operationId, "already-applied");
      }

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "View" AS view
          SET "order" = data."order"
          FROM (VALUES ${Prisma.join(
            orderedIds.map((id, index) =>
              Prisma.sql`(${id}::uuid, ${index}::int)`,
            ),
          )}) AS data("id", "order")
          WHERE view."id" = data."id"
            AND view."userId" = ${userId}::uuid
            AND view."type" = 'CUSTOM'
        `,
      );
      return result(decision.operationId, "applied");
    }

    case "upsert":
      return rejected(decision, "No server semantics for view upsert.");

    default:
      return rejected(
        decision,
        `No server semantics for view ${operation.operationType}.`,
      );
  }
}

async function applyViewListOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;

  if (
    operation.operationType === "upsert" ||
    operation.operationType === "delete"
  ) {
    return rejected(
      decision,
      `No server semantics for viewList ${operation.operationType}.`,
    );
  }

  if (operation.operationType === "reorder") {
    const viewId = getString(operation, "viewId", "viewClientId");
    const orderedIds = getStringArray(operation, "orderedIds");
    if (!viewId || !orderedIds || hasDuplicateIds(orderedIds)) {
      return rejected(
        decision,
        "View-list reorder requires payload.viewId and unique payload.orderedIds.",
      );
    }
    if (orderedIds.length === 0) {
      return result(decision.operationId, "already-applied");
    }

    const view = await tx.view.findFirst({
      where: { id: viewId, userId },
      select: { id: true },
    });
    if (!view) {
      return rejected(decision, "View-list reorder target view is not owned.");
    }

    const memberships = await tx.viewList.findMany({
      where: {
        viewId,
        listId: { in: orderedIds },
        list: { userId },
      },
      select: { listId: true, order: true },
    });
    if (memberships.length !== orderedIds.length) {
      return rejected(
        decision,
        "View-list reorder includes a non-owned membership.",
      );
    }

    const currentOrders = new Map(
      memberships.map((membership) => [membership.listId, membership.order]),
    );
    if (orderedIds.every((id, index) => currentOrders.get(id) === index)) {
      return result(decision.operationId, "already-applied");
    }

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "ViewList" AS view_list
        SET "order" = data."order"
        FROM (VALUES ${Prisma.join(
          orderedIds.map((id, index) =>
            Prisma.sql`(${viewId}::uuid, ${id}::uuid, ${index}::int)`,
          ),
        )}) AS data("viewId", "listId", "order")
        WHERE view_list."viewId" = data."viewId"
          AND view_list."listId" = data."listId"
      `,
    );
    return result(decision.operationId, "applied");
  }

  const listId = getString(operation, "listId", "listClientId");
  const viewId = getString(operation, "viewId", "viewClientId");

  if (operation.operationType === "move") {
    const toViewId = getString(operation, "toViewClientId", "targetViewClientId");
    const order = getInteger(operation, "order", "position");
    if (!listId || !toViewId || order === null) {
      return rejected(
        decision,
        "View-list move requires payload.listId, payload.toViewClientId, and an integer order.",
      );
    }

    const [list, targetView] = await Promise.all([
      tx.list.findFirst({
        where: { id: listId, userId },
        select: { id: true },
      }),
      tx.view.findFirst({
        where: { id: toViewId, userId },
        select: { id: true },
      }),
    ]);
    if (!list || !targetView) {
      return rejected(decision, "View-list move ownership check failed.");
    }

    const existingTarget = await tx.viewList.findUnique({
      where: { viewId_listId: { viewId: toViewId, listId } },
      select: { order: true },
    });
    const sourceViewId = getString(operation, "fromViewId", "fromViewClientId", "viewId");
    let sourceRemoved = false;

    if (sourceViewId && sourceViewId !== toViewId) {
      const sourceView = await tx.view.findFirst({
        where: { id: sourceViewId, userId },
        select: { id: true },
      });
      if (!sourceView) {
        return rejected(decision, "View-list move source view is not owned.");
      }
      const deleted = await tx.viewList.deleteMany({
        where: {
          viewId: sourceViewId,
          listId,
          list: { userId },
        },
      });
      sourceRemoved = deleted.count > 0;
    }

    if (existingTarget?.order === order && !sourceRemoved) {
      return result(decision.operationId, "already-applied");
    }

    await tx.viewList.upsert({
      where: { viewId_listId: { viewId: toViewId, listId } },
      update: { order },
      create: { viewId: toViewId, listId, order },
    });
    return result(decision.operationId, "applied");
  }

  if (!listId || !viewId) {
    return rejected(
      decision,
      "View-list operations require payload.viewId and payload.listId.",
    );
  }

  const [list, view] = await Promise.all([
    tx.list.findFirst({
      where: { id: listId, userId },
      select: { id: true },
    }),
    tx.view.findFirst({
      where: { id: viewId, userId },
      select: { id: true },
    }),
  ]);
  if (!list || !view) {
    return rejected(decision, "View-list ownership check failed.");
  }

  const existing = await tx.viewList.findUnique({
    where: { viewId_listId: { viewId, listId } },
    select: { order: true },
  });

  if (operation.operationType === "attach") {
    const order = getInteger(operation, "order", "position");
    if (order === null) {
      return rejected(decision, "View-list attach requires an integer order.");
    }
    if (existing?.order === order) {
      return result(decision.operationId, "already-applied");
    }
    await tx.viewList.upsert({
      where: { viewId_listId: { viewId, listId } },
      update: { order },
      create: { viewId, listId, order },
    });
    return result(decision.operationId, "applied");
  }

  if (operation.operationType === "detach") {
    if (!existing) {
      return result(decision.operationId, "already-applied");
    }
    await tx.viewList.deleteMany({
      where: {
        viewId,
        listId,
        list: { userId },
        view: { userId },
      },
    });
    return result(decision.operationId, "applied");
  }

  return rejected(
    decision,
    `No server semantics for viewList ${operation.operationType}.`,
  );
}

async function applyMetadataOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
): Promise<SyncApplyOperationResult> {
  const operation = decision.operation;
  if (operation.operationType !== "update" && operation.operationType !== "upsert") {
    return rejected(
      decision,
      `No server semantics for metadata ${operation.operationType}.`,
    );
  }

  const selectedViewId = getString(operation, "selectedViewId", "viewId");
  if (!selectedViewId) {
    return rejected(
      decision,
      "Metadata update/upsert requires payload.selectedViewId.",
    );
  }

  const view = await tx.view.findFirst({
    where: { id: selectedViewId, userId },
    select: { id: true, isDefault: true },
  });
  if (!view) {
    return rejected(decision, "Selected view was not found for this user.");
  }
  if (view.isDefault) {
    return result(decision.operationId, "already-applied");
  }

  await setSelectedView(userId, selectedViewId, tx);
  return result(decision.operationId, "applied");
}

async function applyAcceptedOperation(
  userId: string,
  decision: AcceptedDecision,
  tx: SyncTransaction,
  effects: PostCommitEffects,
): Promise<SyncApplyOperationResult> {
  switch (decision.operation.entityType) {
    case "list":
      return applyListOperation(userId, decision, tx);
    case "listItem":
      return applyListItemOperation(userId, decision, tx);
    case "tag":
      return applyTagOperation(userId, decision, tx, effects);
    case "listTag":
      return applyListTagOperation(userId, decision, tx, effects);
    case "viewTag":
      return applyViewTagOperation(userId, decision, tx, effects);
    case "view":
      return applyViewOperation(userId, decision, tx, effects);
    case "viewList":
      return applyViewListOperation(userId, decision, tx);
    case "metadata":
      return applyMetadataOperation(userId, decision, tx);
  }

  return rejected(
    decision,
    `No server semantics for ${decision.operation.entityType} ${decision.operation.operationType}.`,
  );
}

export async function applySyncOperations({
  userId,
  decisions,
  db: database = db,
}: {
  userId: string;
  decisions: AcceptedDecision[];
  db?: typeof db;
}): Promise<SyncApplyOperationResult[]> {
  if (decisions.length === 0) {
    return [];
  }

  const effects: PostCommitEffects = {
    tagIds: new Set(),
    viewIds: new Set(),
  };

  const results = await database.$transaction(async (tx) => {
    const operationResults: SyncApplyOperationResult[] = [];

    for (const decision of decisions) {
      operationResults.push(
        await applyAcceptedOperation(userId, decision, tx, effects),
      );
    }

    return operationResults;
  });

  try {
    if (effects.tagIds.size > 0) {
      await recomputeCustomViewsForTags(
        userId,
        [...effects.tagIds],
        database,
      );
    }
    if (effects.viewIds.size > 0) {
      await recomputeCustomViewsForIds(
        userId,
        [...effects.viewIds],
        database,
      );
    }
  } catch (error) {
    console.error("Sync post-commit custom-view recompute failed", {
      error,
      userId,
      tagIds: [...effects.tagIds],
      viewIds: [...effects.viewIds],
    });
  }

  return results;
}
