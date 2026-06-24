import type {
  ReadonlyJSONObject,
  ReadonlyJSONValue,
  WriteTransaction,
} from "replicache";

import type {
  LocalJsonValue,
  LocalOutboxEntityType,
  LocalOutboxOperation,
  LocalOutboxOperationType,
} from "@/lib/local-db/outbox-schema";
import type { SyncBatchOperationDecision } from "@/lib/sync/sync-batch-contract";
import { validateSyncEndpointRequest } from "@/lib/sync/sync-endpoint-contract";
import {
  REPLICACHE_KEY_PREFIXES,
  replicacheKeys,
  type ItemStatus,
  type ReplicacheListItemValue,
  type ReplicacheListValue,
  type ReplicacheTagValue,
  type ReplicacheViewListValue,
  type ReplicacheViewValue,
} from "@/lib/sync/replicache/keys";

type TagColor = ReplicacheTagValue["color"];
type ViewMatchMode = ReplicacheViewValue["matchMode"];

export type ReplicacheMutationArgs = {
  createList: {
    id: string;
    userId: string;
    name: string;
    allListsViewId: string;
    order: string;
    inheritedTagIds?: string[];
    now: string;
  };
  renameList: { id: string; name: string; now: string };
  deleteList: { id: string };
  reorderLists: { viewId: string; listId: string; orderKey: string };
  createItem: {
    id: string;
    listId: string;
    name: string;
    order: string;
    now: string;
  };
  updateItem: {
    id: string;
    name?: string;
    completed?: boolean;
    notes?: string | null;
    status?: ItemStatus;
    assigneeId?: string | null;
    boardOrderKey?: string;
    now: string;
  };
  deleteItem: { id: string };
  reorderItems: { listId: string; id: string; orderKey: string };
  moveItem: {
    id: string;
    fromListId: string;
    toListId: string;
    order: string;
    now: string;
  };
  createTag: {
    id: string;
    userId: string;
    name: string;
    color: TagColor;
    now: string;
  };
  updateTag: {
    id: string;
    name?: string;
    color?: TagColor;
    now: string;
  };
  deleteTag: { id: string };
  attachListTag: { listId: string; tagId: string };
  detachListTag: { listId: string; tagId: string };
  createView: {
    id: string;
    userId: string;
    name: string;
    order: string;
    tagIds: string[];
    matchMode?: ViewMatchMode;
    now: string;
  };
  updateView: {
    id: string;
    name?: string;
    tagIds?: string[];
    matchMode?: ViewMatchMode;
    now: string;
  };
  deleteView: { id: string; fallbackViewId?: string };
  reorderViews: { id: string; orderKey: string };
  reorderViewLists: { viewId: string; listId: string; orderKey: string };
  moveViewList: {
    listId: string;
    fromViewId?: string;
    toViewId: string;
    order: string;
  };
  attachViewList: { viewId: string; listId: string; order: string };
  detachViewList: { viewId: string; listId: string };
  attachViewTag: { viewId: string; tagId: string };
  detachViewTag: { viewId: string; tagId: string };
  setSelectedView: { viewId: string };
};

export type ReplicacheMutationName = keyof ReplicacheMutationArgs;

function isReadonlyJSONObject(
  value: ReadonlyJSONValue,
): value is ReadonlyJSONObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function deleteKeys(
  tx: WriteTransaction,
  prefix: string,
  predicate: (key: string, value: ReadonlyJSONValue) => boolean,
) {
  const entries = await tx.scan({ prefix }).entries().toArray();
  for (const [key, value] of entries) {
    if (predicate(key, value)) {
      await tx.del(key);
    }
  }
}

export const replicacheMutators = {
  async createList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["createList"],
  ) {
    const list: ReplicacheListValue = {
      id: args.id,
      userId: args.userId,
      name: args.name,
      workspaceId: null,
      createdAt: args.now,
      updatedAt: args.now,
    };
    await tx.set(replicacheKeys.list(args.id), list);
    await tx.set(replicacheKeys.viewList(args.allListsViewId, args.id), {
      viewId: args.allListsViewId,
      listId: args.id,
      order: args.order,
    });
    for (const tagId of new Set(args.inheritedTagIds ?? [])) {
      await tx.set(replicacheKeys.listTag(args.id, tagId), {
        listId: args.id,
        tagId,
      });
    }
  },

  async renameList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["renameList"],
  ) {
    const current = await tx.get<ReplicacheListValue>(
      replicacheKeys.list(args.id),
    );
    if (current) {
      await tx.set(replicacheKeys.list(args.id), {
        ...current,
        name: args.name,
        updatedAt: args.now,
      });
    }
  },

  async deleteList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["deleteList"],
  ) {
    await tx.del(replicacheKeys.list(args.id));
    await deleteKeys(
      tx,
      REPLICACHE_KEY_PREFIXES.listItem,
      (_key, value) =>
        isReadonlyJSONObject(value) && value.listId === args.id,
    );
    await deleteKeys(
      tx,
      REPLICACHE_KEY_PREFIXES.listTag,
      (_key, value) =>
        isReadonlyJSONObject(value) && value.listId === args.id,
    );
    await deleteKeys(
      tx,
      REPLICACHE_KEY_PREFIXES.viewList,
      (_key, value) =>
        isReadonlyJSONObject(value) && value.listId === args.id,
    );
  },

  async reorderLists(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["reorderLists"],
  ) {
    const key = replicacheKeys.viewList(args.viewId, args.listId);
    const current = await tx.get<ReplicacheViewListValue>(key);
    await tx.set(key, current
      ? { ...current, order: args.orderKey }
      : {
          viewId: args.viewId,
          listId: args.listId,
          order: args.orderKey,
        });
  },

  async createItem(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["createItem"],
  ) {
    const item: ReplicacheListItemValue = {
      id: args.id,
      listId: args.listId,
      name: args.name,
      order: args.order,
      completed: false,
      status: "TODO",
      assigneeId: null,
      boardOrderKey: args.order,
      notes: null,
      createdAt: args.now,
      updatedAt: args.now,
    };
    await tx.set(replicacheKeys.listItem(args.id), item);
  },

  async updateItem(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["updateItem"],
  ) {
    const current = await tx.get<ReplicacheListItemValue>(
      replicacheKeys.listItem(args.id),
    );
    if (current) {
      await tx.set(replicacheKeys.listItem(args.id), {
        ...current,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.completed !== undefined ? { completed: args.completed } : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.assigneeId !== undefined
          ? { assigneeId: args.assigneeId }
          : {}),
        ...(args.boardOrderKey !== undefined
          ? { boardOrderKey: args.boardOrderKey }
          : {}),
        updatedAt: args.now,
      });
    }
  },

  async deleteItem(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["deleteItem"],
  ) {
    await tx.del(replicacheKeys.listItem(args.id));
  },

  async reorderItems(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["reorderItems"],
  ) {
    const key = replicacheKeys.listItem(args.id);
    const current = await tx.get<ReplicacheListItemValue>(key);
    if (current && current.listId === args.listId) {
      await tx.set(key, { ...current, order: args.orderKey });
    }
  },

  async moveItem(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["moveItem"],
  ) {
    const key = replicacheKeys.listItem(args.id);
    const current = await tx.get<ReplicacheListItemValue>(key);
    if (current) {
      await tx.set(key, {
        ...current,
        listId: args.toListId,
        order: args.order,
        updatedAt: args.now,
      });
    }
  },

  async createTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["createTag"],
  ) {
    await tx.set(replicacheKeys.tag(args.id), {
      id: args.id,
      userId: args.userId,
      name: args.name,
      color: args.color,
      createdAt: args.now,
      updatedAt: args.now,
    });
  },

  async updateTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["updateTag"],
  ) {
    const key = replicacheKeys.tag(args.id);
    const current = await tx.get<ReplicacheTagValue>(key);
    if (current) {
      await tx.set(key, {
        ...current,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.color !== undefined ? { color: args.color } : {}),
        updatedAt: args.now,
      });
    }
  },

  async deleteTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["deleteTag"],
  ) {
    await tx.del(replicacheKeys.tag(args.id));
    await deleteKeys(
      tx,
      REPLICACHE_KEY_PREFIXES.listTag,
      (_key, value) =>
        isReadonlyJSONObject(value) && value.tagId === args.id,
    );
    await deleteKeys(
      tx,
      REPLICACHE_KEY_PREFIXES.viewTag,
      (_key, value) =>
        isReadonlyJSONObject(value) && value.tagId === args.id,
    );
  },

  async attachListTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["attachListTag"],
  ) {
    await tx.set(replicacheKeys.listTag(args.listId, args.tagId), args);
  },

  async detachListTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["detachListTag"],
  ) {
    await tx.del(replicacheKeys.listTag(args.listId, args.tagId));
  },

  async createView(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["createView"],
  ) {
    const existingViews = await tx
      .scan<ReplicacheViewValue>({ prefix: REPLICACHE_KEY_PREFIXES.view })
      .values()
      .toArray();
    for (const view of existingViews) {
      if (view.isDefault) {
        await tx.set(replicacheKeys.view(view.id), {
          ...view,
          isDefault: false,
        });
      }
    }
    await tx.set(replicacheKeys.view(args.id), {
      id: args.id,
      userId: args.userId,
      name: args.name,
      order: args.order,
      type: "CUSTOM",
      isDefault: true,
      matchMode: args.matchMode ?? "ALL",
      createdAt: args.now,
      updatedAt: args.now,
    });
    for (const tagId of new Set(args.tagIds)) {
      await tx.set(replicacheKeys.viewTag(args.id, tagId), {
        viewId: args.id,
        tagId,
      });
    }
    await tx.set(replicacheKeys.selectedView, args.id);
  },

  async updateView(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["updateView"],
  ) {
    const key = replicacheKeys.view(args.id);
    const current = await tx.get<ReplicacheViewValue>(key);
    if (current) {
      await tx.set(key, {
        ...current,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.matchMode !== undefined ? { matchMode: args.matchMode } : {}),
        updatedAt: args.now,
      });
    }
    if (args.tagIds !== undefined) {
      await deleteKeys(
        tx,
        `${REPLICACHE_KEY_PREFIXES.viewTag}${args.id}/`,
        () => true,
      );
      for (const tagId of new Set(args.tagIds)) {
        await tx.set(replicacheKeys.viewTag(args.id, tagId), {
          viewId: args.id,
          tagId,
        });
      }
    }
  },

  async deleteView(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["deleteView"],
  ) {
    await tx.del(replicacheKeys.view(args.id));
    await deleteKeys(
      tx,
      `${REPLICACHE_KEY_PREFIXES.viewTag}${args.id}/`,
      () => true,
    );
    await deleteKeys(
      tx,
      `${REPLICACHE_KEY_PREFIXES.viewList}${args.id}/`,
      () => true,
    );
    const selected = await tx.get<string>(replicacheKeys.selectedView);
    if (selected === args.id && args.fallbackViewId) {
      await replicacheMutators.setSelectedView(tx, {
        viewId: args.fallbackViewId,
      });
    }
  },

  async reorderViews(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["reorderViews"],
  ) {
    const key = replicacheKeys.view(args.id);
    const current = await tx.get<ReplicacheViewValue>(key);
    if (current) {
      await tx.set(key, { ...current, order: args.orderKey });
    }
  },

  async reorderViewLists(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["reorderViewLists"],
  ) {
    const key = replicacheKeys.viewList(args.viewId, args.listId);
    const current = await tx.get<ReplicacheViewListValue>(key);
    await tx.set(key, current
      ? { ...current, order: args.orderKey }
      : {
          viewId: args.viewId,
          listId: args.listId,
          order: args.orderKey,
        });
  },

  async moveViewList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["moveViewList"],
  ) {
    if (args.fromViewId && args.fromViewId !== args.toViewId) {
      await tx.del(replicacheKeys.viewList(args.fromViewId, args.listId));
    }
    await tx.set(replicacheKeys.viewList(args.toViewId, args.listId), {
      viewId: args.toViewId,
      listId: args.listId,
      order: args.order,
    });
  },

  async attachViewList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["attachViewList"],
  ) {
    await tx.set(replicacheKeys.viewList(args.viewId, args.listId), args);
  },

  async detachViewList(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["detachViewList"],
  ) {
    await tx.del(replicacheKeys.viewList(args.viewId, args.listId));
  },

  async attachViewTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["attachViewTag"],
  ) {
    await tx.set(replicacheKeys.viewTag(args.viewId, args.tagId), args);
  },

  async detachViewTag(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["detachViewTag"],
  ) {
    await tx.del(replicacheKeys.viewTag(args.viewId, args.tagId));
  },

  async setSelectedView(
    tx: WriteTransaction,
    args: ReplicacheMutationArgs["setSelectedView"],
  ) {
    const views = await tx
      .scan<ReplicacheViewValue>({ prefix: REPLICACHE_KEY_PREFIXES.view })
      .values()
      .toArray();
    for (const view of views) {
      const isDefault = view.id === args.viewId;
      if (view.isDefault !== isDefault) {
        await tx.set(replicacheKeys.view(view.id), {
          ...view,
          isDefault,
        });
      }
    }
    await tx.set(replicacheKeys.selectedView, args.viewId);
  },
} satisfies {
  [Name in ReplicacheMutationName]: (
    tx: WriteTransaction,
    args: ReplicacheMutationArgs[Name],
  ) => Promise<void>;
};

type OperationDescriptor = {
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
};

function describeMutation<Name extends ReplicacheMutationName>(
  name: Name,
  args: ReplicacheMutationArgs[Name],
): OperationDescriptor[] {
  switch (name) {
    case "createList": {
      const value = args as ReplicacheMutationArgs["createList"];
      return [{
        entityType: "list",
        entityClientId: value.id,
        operationType: "create",
        payload: {
          name: value.name,
          orderKey: value.order,
          ...(value.inheritedTagIds?.length
            ? { tagIds: value.inheritedTagIds }
            : {}),
        },
      }];
    }
    case "renameList": {
      const value = args as ReplicacheMutationArgs["renameList"];
      return [{
        entityType: "list",
        entityClientId: value.id,
        operationType: "update",
        payload: { name: value.name },
      }];
    }
    case "deleteList": {
      const value = args as ReplicacheMutationArgs["deleteList"];
      return [{
        entityType: "list",
        entityClientId: value.id,
        operationType: "delete",
        payload: { deleted: true },
      }];
    }
    case "reorderLists":
    case "reorderViewLists": {
      const value = args as ReplicacheMutationArgs["reorderLists"];
      return [{
        entityType: "viewList",
        entityClientId: `${value.viewId}:${value.listId}`,
        operationType: "reorder",
        payload: {
          viewId: value.viewId,
          listId: value.listId,
          orderKey: value.orderKey,
        },
      }];
    }
    case "createItem": {
      const value = args as ReplicacheMutationArgs["createItem"];
      return [{
        entityType: "listItem",
        entityClientId: value.id,
        operationType: "create",
        payload: {
          name: value.name,
          listId: value.listId,
          orderKey: value.order,
        },
      }];
    }
    case "updateItem": {
      const value = args as ReplicacheMutationArgs["updateItem"];
      return [{
        entityType: "listItem",
        entityClientId: value.id,
        operationType: "update",
        payload: {
          ...(value.name !== undefined ? { name: value.name } : {}),
          ...(value.completed !== undefined
            ? { completed: value.completed }
            : {}),
          ...(value.notes !== undefined ? { notes: value.notes } : {}),
          ...(value.status !== undefined ? { status: value.status } : {}),
          ...(value.assigneeId !== undefined
            ? { assigneeId: value.assigneeId }
            : {}),
          ...(value.boardOrderKey !== undefined
            ? { boardOrderKey: value.boardOrderKey }
            : {}),
        },
      }];
    }
    case "deleteItem": {
      const value = args as ReplicacheMutationArgs["deleteItem"];
      return [{
        entityType: "listItem",
        entityClientId: value.id,
        operationType: "delete",
        payload: { deleted: true },
      }];
    }
    case "reorderItems": {
      const value = args as ReplicacheMutationArgs["reorderItems"];
      return [{
        entityType: "listItem",
        entityClientId: value.id,
        operationType: "reorder",
        payload: {
          listId: value.listId,
          itemId: value.id,
          orderKey: value.orderKey,
        },
      }];
    }
    case "moveItem": {
      const value = args as ReplicacheMutationArgs["moveItem"];
      return [{
        entityType: "listItem",
        entityClientId: value.id,
        operationType: "move",
        payload: {
          toListClientId: value.toListId,
          orderKey: value.order,
        },
      }];
    }
    case "createTag": {
      const value = args as ReplicacheMutationArgs["createTag"];
      return [{
        entityType: "tag",
        entityClientId: value.id,
        operationType: "create",
        payload: { name: value.name, color: value.color },
      }];
    }
    case "updateTag": {
      const value = args as ReplicacheMutationArgs["updateTag"];
      return [{
        entityType: "tag",
        entityClientId: value.id,
        operationType: "update",
        payload: {
          ...(value.name !== undefined ? { name: value.name } : {}),
          ...(value.color !== undefined ? { color: value.color } : {}),
        },
      }];
    }
    case "deleteTag": {
      const value = args as ReplicacheMutationArgs["deleteTag"];
      return [{
        entityType: "tag",
        entityClientId: value.id,
        operationType: "delete",
        payload: { deleted: true },
      }];
    }
    case "attachListTag":
    case "detachListTag": {
      const value = args as ReplicacheMutationArgs["attachListTag"];
      return [{
        entityType: "listTag",
        entityClientId: `${value.listId}:${value.tagId}`,
        operationType: name === "attachListTag" ? "attach" : "detach",
        payload: { listId: value.listId, tagId: value.tagId },
      }];
    }
    case "createView": {
      const value = args as ReplicacheMutationArgs["createView"];
      return [{
        entityType: "view",
        entityClientId: value.id,
        operationType: "create",
        payload: {
          name: value.name,
          tagIds: value.tagIds,
          matchMode: value.matchMode ?? "ALL",
          orderKey: value.order,
        },
      }];
    }
    case "updateView": {
      const value = args as ReplicacheMutationArgs["updateView"];
      return [{
        entityType: "view",
        entityClientId: value.id,
        operationType: "update",
        payload: {
          ...(value.name !== undefined ? { name: value.name } : {}),
          ...(value.tagIds !== undefined ? { tagIds: value.tagIds } : {}),
          ...(value.matchMode !== undefined
            ? { matchMode: value.matchMode }
            : {}),
        },
      }];
    }
    case "deleteView": {
      const value = args as ReplicacheMutationArgs["deleteView"];
      return [{
        entityType: "view",
        entityClientId: value.id,
        operationType: "delete",
        payload: { deleted: true },
      }];
    }
    case "reorderViews": {
      const value = args as ReplicacheMutationArgs["reorderViews"];
      return [{
        entityType: "view",
        entityClientId: value.id,
        operationType: "reorder",
        payload: { viewId: value.id, orderKey: value.orderKey },
      }];
    }
    case "moveViewList": {
      const value = args as ReplicacheMutationArgs["moveViewList"];
      return [{
        entityType: "viewList",
        entityClientId: `${value.toViewId}:${value.listId}`,
        operationType: "move",
        payload: {
          listId: value.listId,
          ...(value.fromViewId ? { fromViewId: value.fromViewId } : {}),
          toViewClientId: value.toViewId,
          orderKey: value.order,
        },
      }];
    }
    case "attachViewList":
    case "detachViewList": {
      const value = args as ReplicacheMutationArgs["attachViewList"];
      return [{
        entityType: "viewList",
        entityClientId: `${value.viewId}:${value.listId}`,
        operationType: name === "attachViewList" ? "attach" : "detach",
        payload: {
          viewId: value.viewId,
          listId: value.listId,
          ...(name === "attachViewList" ? { orderKey: value.order } : {}),
        },
      }];
    }
    case "attachViewTag":
    case "detachViewTag": {
      const value = args as ReplicacheMutationArgs["attachViewTag"];
      return [{
        entityType: "viewTag",
        entityClientId: `${value.viewId}:${value.tagId}`,
        operationType: name === "attachViewTag" ? "attach" : "detach",
        payload: { viewId: value.viewId, tagId: value.tagId },
      }];
    }
    case "setSelectedView": {
      const value = args as ReplicacheMutationArgs["setSelectedView"];
      return [{
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        payload: { selectedViewId: value.viewId },
      }];
    }
  }
}

export function translateReplicacheMutation({
  userId,
  clientID,
  mutationID,
  name,
  args,
  timestamp,
}: {
  userId: string;
  clientID: string;
  mutationID: number;
  name: ReplicacheMutationName;
  args: ReplicacheMutationArgs[ReplicacheMutationName];
  timestamp: number;
}): SyncBatchOperationDecision[] {
  const now = new Date(timestamp).toISOString();

  return describeMutation(name, args).map((descriptor, index) => {
    const operationId = `${clientID}:${mutationID}:${index}`;
    const operation: LocalOutboxOperation = {
      operationId,
      userId,
      entityType: descriptor.entityType,
      entityClientId: descriptor.entityClientId,
      entityServerId: descriptor.entityClientId,
      operationType: descriptor.operationType,
      payload: descriptor.payload,
      status: "syncing",
      retryCount: 0,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      lastAttemptedAt: now,
      idempotencyKey: operationId,
    };
    const validation = validateSyncEndpointRequest(
      { operation, idempotencyKey: operationId },
      { authenticatedUserId: userId },
    );

    if (!validation.ok) {
      return {
        operationId,
        idempotencyKey: operationId,
        accepted: false,
        errors: validation.errors,
      };
    }

    return {
      operationId,
      idempotencyKey: operationId,
      accepted: true,
      operation,
    };
  });
}

export function isReplicacheMutationName(
  value: string,
): value is ReplicacheMutationName {
  return value in replicacheMutators;
}
