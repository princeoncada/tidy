import type { ReadonlyJSONValue } from "replicache";

import type {
  LocalJsonValue,
  LocalOutboxEntityType,
  LocalOutboxOperation,
  LocalOutboxOperationType,
} from "@/lib/local-db/outbox-schema";
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
import type { ReplicacheClientView } from "@/lib/sync/replicache/pull-cvr";
import type { AcceptedSyncDecision } from "@/lib/sync/server-apply";

type RevertTarget = Record<string, ReadonlyJSONValue>;

type PlannedOperation = {
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
  key: string;
};

type ReplicacheEntityType =
  | "list"
  | "listItem"
  | "tag"
  | "view"
  | "viewList"
  | "viewTag"
  | "listTag"
  | "metadata";

const FIXED_OPERATION_TIME = "1970-01-01T00:00:00.000Z";

const UPSERT_ORDER: Record<ReplicacheEntityType, number> = {
  list: 0,
  view: 1,
  tag: 2,
  metadata: 3,
  listItem: 4,
  viewList: 5,
  viewTag: 6,
  listTag: 7,
};

const DELETE_ORDER: Record<ReplicacheEntityType, number> = {
  listTag: 0,
  viewTag: 1,
  viewList: 2,
  listItem: 3,
  metadata: 4,
  list: 5,
  view: 6,
  tag: 7,
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTargetValue<T extends ReadonlyJSONValue>(
  target: RevertTarget,
  key: string,
): T | undefined {
  return target[key] as T | undefined;
}

function getCurrentValue<T extends ReadonlyJSONValue>(
  current: ReplicacheClientView,
  key: string,
): T | undefined {
  return current[key]?.value as T | undefined;
}

function entityTypeForKey(key: string): ReplicacheEntityType | null {
  if (key === replicacheKeys.selectedView) return "metadata";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.list)) return "list";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.listItem)) return "listItem";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.tag)) return "tag";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.view)) return "view";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.viewList)) return "viewList";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.viewTag)) return "viewTag";
  if (key.startsWith(REPLICACHE_KEY_PREFIXES.listTag)) return "listTag";
  return null;
}

function idFromKey(key: string, prefix: string): string {
  return key.slice(prefix.length);
}

function partsFromKey(key: string, prefix: string): [string, string] | null {
  const parts = key.slice(prefix.length).split("/");
  return parts.length === 2 && parts[0] && parts[1]
    ? [parts[0], parts[1]]
    : null;
}

function viewTagIdsFor(target: RevertTarget, viewId: string): string[] {
  return Object.entries(target)
    .filter(([key, value]) =>
      key.startsWith(`${REPLICACHE_KEY_PREFIXES.viewTag}${viewId}/`) &&
      isRecord(value) &&
      typeof value.tagId === "string"
    )
    .map(([, value]) => (value as ReplicacheViewTagValue).tagId)
    .sort();
}

function findUserId({
  current,
  target,
  key,
  value,
}: {
  current: ReplicacheClientView;
  target: RevertTarget;
  key: string;
  value: ReadonlyJSONValue | undefined;
}): string {
  if (isRecord(value) && typeof value.userId === "string") {
    return value.userId;
  }

  const entityType = entityTypeForKey(key);
  const candidates: Array<ReadonlyJSONValue | undefined> = [];
  if (entityType === "listItem" && isRecord(value)) {
    const listId = typeof value.listId === "string" ? value.listId : null;
    if (listId) {
      candidates.push(
        target[replicacheKeys.list(listId)],
        current[replicacheKeys.list(listId)]?.value,
      );
    }
  }
  if (entityType === "listTag") {
    const parts = partsFromKey(key, REPLICACHE_KEY_PREFIXES.listTag);
    if (parts) {
      candidates.push(
        target[replicacheKeys.list(parts[0])],
        current[replicacheKeys.list(parts[0])]?.value,
        target[replicacheKeys.tag(parts[1])],
        current[replicacheKeys.tag(parts[1])]?.value,
      );
    }
  }
  if (entityType === "viewTag") {
    const parts = partsFromKey(key, REPLICACHE_KEY_PREFIXES.viewTag);
    if (parts) {
      candidates.push(
        target[replicacheKeys.view(parts[0])],
        current[replicacheKeys.view(parts[0])]?.value,
        target[replicacheKeys.tag(parts[1])],
        current[replicacheKeys.tag(parts[1])]?.value,
      );
    }
  }
  if (entityType === "viewList") {
    const parts = partsFromKey(key, REPLICACHE_KEY_PREFIXES.viewList);
    if (parts) {
      candidates.push(
        target[replicacheKeys.view(parts[0])],
        current[replicacheKeys.view(parts[0])]?.value,
        target[replicacheKeys.list(parts[1])],
        current[replicacheKeys.list(parts[1])]?.value,
      );
    }
  }
  if (entityType === "metadata" && typeof value === "string") {
    candidates.push(
      target[replicacheKeys.view(value)],
      current[replicacheKeys.view(value)]?.value,
    );
  }

  for (const candidate of candidates) {
    if (isRecord(candidate) && typeof candidate.userId === "string") {
      return candidate.userId;
    }
  }

  throw new Error(`Unable to derive revert user id for ${key}.`);
}

function operationToDecision(
  operation: PlannedOperation,
  userId: string,
  index: number,
): AcceptedSyncDecision {
  const operationId = `revert:${index}:${operation.entityType}:${operation.operationType}:${operation.entityClientId}`;
  const outboxOperation: LocalOutboxOperation = {
    operationId,
    userId,
    entityType: operation.entityType,
    entityClientId: operation.entityClientId,
    entityServerId: operation.entityClientId,
    operationType: operation.operationType,
    payload: operation.payload,
    status: "syncing",
    retryCount: 0,
    errorMessage: null,
    createdAt: FIXED_OPERATION_TIME,
    updatedAt: FIXED_OPERATION_TIME,
    lastAttemptedAt: FIXED_OPERATION_TIME,
    idempotencyKey: operationId,
  };

  return {
    operationId,
    idempotencyKey: operationId,
    accepted: true,
    operation: outboxOperation,
  };
}

function planList(
  key: string,
  currentValue: ReplicacheListValue | undefined,
  targetValue: ReplicacheListValue | undefined,
): PlannedOperation[] {
  const id = idFromKey(key, REPLICACHE_KEY_PREFIXES.list);
  if (!targetValue) {
    return [{
      entityType: "list",
      entityClientId: id,
      operationType: "delete",
      payload: { deleted: true },
      key,
    }];
  }
  if (!currentValue) {
    return [{
      entityType: "list",
      entityClientId: id,
      operationType: "create",
      payload: { name: targetValue.name },
      key,
    }];
  }
  return currentValue.name === targetValue.name
    ? []
    : [{
        entityType: "list",
        entityClientId: id,
        operationType: "update",
        payload: { name: targetValue.name },
        key,
      }];
}

function planListItem(
  key: string,
  currentValue: ReplicacheListItemValue | undefined,
  targetValue: ReplicacheListItemValue | undefined,
): PlannedOperation[] {
  const id = idFromKey(key, REPLICACHE_KEY_PREFIXES.listItem);
  if (!targetValue) {
    return [{
      entityType: "listItem",
      entityClientId: id,
      operationType: "delete",
      payload: { deleted: true },
      key,
    }];
  }

  const operations: PlannedOperation[] = [];
  if (!currentValue) {
    operations.push({
      entityType: "listItem",
      entityClientId: id,
      operationType: "create",
      payload: {
        name: targetValue.name,
        listId: targetValue.listId,
        orderKey: targetValue.order,
        completed: targetValue.completed,
        notes: targetValue.notes,
      },
      key,
    });
  } else {
    if (currentValue.listId !== targetValue.listId) {
      operations.push({
        entityType: "listItem",
        entityClientId: id,
        operationType: "move",
        payload: {
          toListClientId: targetValue.listId,
          orderKey: targetValue.order,
        },
        key,
      });
    } else if (currentValue.order !== targetValue.order) {
      operations.push({
        entityType: "listItem",
        entityClientId: id,
        operationType: "reorder",
        payload: {
          listId: targetValue.listId,
          itemId: id,
          orderKey: targetValue.order,
        },
        key,
      });
    }
  }

  const updatePayload: Record<string, LocalJsonValue> = {};
  if (!currentValue || currentValue.name !== targetValue.name) {
    updatePayload.name = targetValue.name;
  }
  if (!currentValue || currentValue.completed !== targetValue.completed) {
    updatePayload.completed = targetValue.completed;
  }
  if (!currentValue || currentValue.notes !== targetValue.notes) {
    updatePayload.notes = targetValue.notes;
  }
  if (!currentValue || currentValue.status !== targetValue.status) {
    updatePayload.status = targetValue.status;
  }
  if (!currentValue || currentValue.assigneeId !== targetValue.assigneeId) {
    updatePayload.assigneeId = targetValue.assigneeId;
  }
  if (
    targetValue.boardOrderKey &&
    (!currentValue || currentValue.boardOrderKey !== targetValue.boardOrderKey)
  ) {
    updatePayload.boardOrderKey = targetValue.boardOrderKey;
  }
  if (Object.keys(updatePayload).length > 0) {
    operations.push({
      entityType: "listItem",
      entityClientId: id,
      operationType: "update",
      payload: updatePayload,
      key,
    });
  }

  return operations;
}

function planTag(
  key: string,
  currentValue: ReplicacheTagValue | undefined,
  targetValue: ReplicacheTagValue | undefined,
): PlannedOperation[] {
  const id = idFromKey(key, REPLICACHE_KEY_PREFIXES.tag);
  if (!targetValue) {
    return [{
      entityType: "tag",
      entityClientId: id,
      operationType: "delete",
      payload: { deleted: true },
      key,
    }];
  }
  if (!currentValue) {
    return [{
      entityType: "tag",
      entityClientId: id,
      operationType: "create",
      payload: { name: targetValue.name, color: targetValue.color },
      key,
    }];
  }
  const payload: Record<string, LocalJsonValue> = {};
  if (currentValue.name !== targetValue.name) payload.name = targetValue.name;
  if (currentValue.color !== targetValue.color) payload.color = targetValue.color;
  return Object.keys(payload).length === 0
    ? []
    : [{
        entityType: "tag",
        entityClientId: id,
        operationType: "update",
        payload,
        key,
      }];
}

function planView(
  key: string,
  currentValue: ReplicacheViewValue | undefined,
  targetValue: ReplicacheViewValue | undefined,
  target: RevertTarget,
): PlannedOperation[] {
  const id = idFromKey(key, REPLICACHE_KEY_PREFIXES.view);
  if (!targetValue) {
    return [{
      entityType: "view",
      entityClientId: id,
      operationType: "delete",
      payload: { deleted: true },
      key,
    }];
  }
  if (!currentValue) {
    return targetValue.type === "CUSTOM"
      ? [{
          entityType: "view",
          entityClientId: id,
          operationType: "create",
          payload: {
            name: targetValue.name,
            tagIds: viewTagIdsFor(target, id),
            matchMode: targetValue.matchMode,
            orderKey: targetValue.order,
          },
          key,
        }]
      : [];
  }

  const operations: PlannedOperation[] = [];
  if (currentValue.order !== targetValue.order && targetValue.type === "CUSTOM") {
    operations.push({
      entityType: "view",
      entityClientId: id,
      operationType: "reorder",
      payload: { viewId: id, orderKey: targetValue.order },
      key,
    });
  }

  const payload: Record<string, LocalJsonValue> = {};
  if (currentValue.name !== targetValue.name) payload.name = targetValue.name;
  if (currentValue.matchMode !== targetValue.matchMode) {
    payload.matchMode = targetValue.matchMode;
  }
  const tagIds = viewTagIdsFor(target, id);
  if (tagIds.length > 0) payload.tagIds = tagIds;
  if (targetValue.type === "CUSTOM" && Object.keys(payload).length > 0) {
    operations.push({
      entityType: "view",
      entityClientId: id,
      operationType: "update",
      payload,
      key,
    });
  }
  return operations;
}

function planViewList(
  key: string,
  currentValue: ReplicacheViewListValue | undefined,
  targetValue: ReplicacheViewListValue | undefined,
): PlannedOperation[] {
  const parts = partsFromKey(key, REPLICACHE_KEY_PREFIXES.viewList);
  if (!parts) return [];
  const [viewId, listId] = parts;
  const entityClientId = `${viewId}:${listId}`;
  if (!targetValue) {
    return [{
      entityType: "viewList",
      entityClientId,
      operationType: "detach",
      payload: { viewId, listId },
      key,
    }];
  }
  if (!currentValue) {
    return [{
      entityType: "viewList",
      entityClientId,
      operationType: "attach",
      payload: { viewId, listId, orderKey: targetValue.order },
      key,
    }];
  }
  return currentValue.order === targetValue.order
    ? []
    : [{
        entityType: "viewList",
        entityClientId,
        operationType: "reorder",
        payload: { viewId, listId, orderKey: targetValue.order },
        key,
      }];
}

function planLink(
  key: string,
  entityType: "viewTag" | "listTag",
  prefix: string,
  currentValue: ReadonlyJSONValue | undefined,
  targetValue: ReplicacheViewTagValue | ReplicacheListTagValue | undefined,
): PlannedOperation[] {
  const parts = partsFromKey(key, prefix);
  if (!parts) return [];
  const [leftId, rightId] = parts;
  const payload = entityType === "viewTag"
    ? { viewId: leftId, tagId: rightId }
    : { listId: leftId, tagId: rightId };
  return targetValue && !currentValue
    ? [{
        entityType,
        entityClientId: `${leftId}:${rightId}`,
        operationType: "attach",
        payload,
        key,
      }]
    : !targetValue && currentValue
      ? [{
          entityType,
          entityClientId: `${leftId}:${rightId}`,
          operationType: "detach",
          payload,
          key,
        }]
      : [];
}

function planMetadata(
  key: string,
  targetValue: ReadonlyJSONValue | undefined,
): PlannedOperation[] {
  return typeof targetValue === "string"
    ? [{
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        payload: { selectedViewId: targetValue },
        key,
      }]
    : [];
}

function buildOperationsForKey({
  key,
  current,
  target,
}: {
  key: string;
  current: ReplicacheClientView;
  target: RevertTarget;
}): PlannedOperation[] {
  const entityType = entityTypeForKey(key);
  if (!entityType) return [];

  switch (entityType) {
    case "list":
      return planList(
        key,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "listItem":
      return planListItem(
        key,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "tag":
      return planTag(
        key,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "view":
      return planView(
        key,
        getCurrentValue(current, key),
        getTargetValue(target, key),
        target,
      );
    case "viewList":
      return planViewList(
        key,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "viewTag":
      return planLink(
        key,
        "viewTag",
        REPLICACHE_KEY_PREFIXES.viewTag,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "listTag":
      return planLink(
        key,
        "listTag",
        REPLICACHE_KEY_PREFIXES.listTag,
        getCurrentValue(current, key),
        getTargetValue(target, key),
      );
    case "metadata":
      return planMetadata(key, getTargetValue(target, key));
  }
}

export function buildRevertPlan({
  current,
  target,
  affectedKeys,
}: {
  current: ReplicacheClientView;
  target: RevertTarget;
  affectedKeys: ReadonlySet<string>;
}): AcceptedSyncDecision[] {
  const planned = [...affectedKeys]
    .sort()
    .flatMap((key) => {
      const currentValue = current[key]?.value;
      const targetValue = target[key];
      if (deepEqual(currentValue, targetValue)) return [];
      return buildOperationsForKey({ key, current, target });
    });

  const ordered = planned.sort((left, right) => {
    const leftType = (entityTypeForKey(left.key) ?? left.entityType) as ReplicacheEntityType;
    const rightType = (entityTypeForKey(right.key) ?? right.entityType) as ReplicacheEntityType;
    const leftIsDelete = left.operationType === "delete" ||
      left.operationType === "detach";
    const rightIsDelete = right.operationType === "delete" ||
      right.operationType === "detach";
    const leftGroup = leftIsDelete ? 0 : 1;
    const rightGroup = rightIsDelete ? 0 : 1;
    const leftOrder = leftIsDelete
      ? DELETE_ORDER[leftType]
      : UPSERT_ORDER[leftType];
    const rightOrder = rightIsDelete
      ? DELETE_ORDER[rightType]
      : UPSERT_ORDER[rightType];
    return leftGroup - rightGroup ||
      leftOrder - rightOrder ||
      left.key.localeCompare(right.key) ||
      left.operationType.localeCompare(right.operationType);
  });

  return ordered.map((operation, index) =>
    operationToDecision(
      operation,
      findUserId({
        current,
        target,
        key: operation.key,
        value: target[operation.key] ?? current[operation.key]?.value,
      }),
      index,
    )
  );
}
