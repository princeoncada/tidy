import type { LocalOutboxOperation } from "./outbox-schema";

export type CoalescedOutboxOperations = {
  operations: LocalOutboxOperation[];
  discardedOperationIds: string[];
};

function getEntityKey(operation: LocalOutboxOperation): string {
  return [
    operation.userId,
    operation.entityType,
    operation.entityClientId,
  ].join(":");
}

function isPendingOperation(operation: LocalOutboxOperation): boolean {
  return operation.status === "pending";
}

function isSupersededByDelete(operation: LocalOutboxOperation): boolean {
  return ["update", "reorder", "move", "attach", "detach", "upsert"].includes(operation.operationType);
}

function isLatestOnlyOperation(operation: LocalOutboxOperation): boolean {
  return ["update", "reorder", "move"].includes(operation.operationType);
}

function isUnsyncedCreateDeletePair(
  existing: LocalOutboxOperation,
  next: LocalOutboxOperation,
): boolean {
  return (
    existing.operationType === "create" &&
    next.operationType === "delete" &&
    existing.entityServerId === null &&
    next.entityServerId === null
  );
}

function shouldReplaceExistingOperation(
  existing: LocalOutboxOperation,
  next: LocalOutboxOperation,
): boolean {
  if (existing.operationType === next.operationType && isLatestOnlyOperation(next)) {
    return true;
  }

  return (
    (existing.operationType === "move" && next.operationType === "reorder") ||
    (existing.operationType === "reorder" && next.operationType === "move")
  );
}

export function coalesceOutboxOperations(
  operations: readonly LocalOutboxOperation[],
): CoalescedOutboxOperations {
  const coalescedOperations: Array<LocalOutboxOperation | null> = [];
  const discardedOperationIds = new Set<string>();
  const latestPendingIndexByEntity = new Map<string, number>();

  for (const operation of operations) {
    if (!isPendingOperation(operation)) {
      coalescedOperations.push(operation);
      continue;
    }

    const entityKey = getEntityKey(operation);
    const existingIndex = latestPendingIndexByEntity.get(entityKey);

    if (existingIndex === undefined) {
      coalescedOperations.push(operation);
      latestPendingIndexByEntity.set(entityKey, coalescedOperations.length - 1);
      continue;
    }

    const existingOperation = coalescedOperations[existingIndex];

    if (!existingOperation) {
      coalescedOperations.push(operation);
      latestPendingIndexByEntity.set(entityKey, coalescedOperations.length - 1);
      continue;
    }

    if (isUnsyncedCreateDeletePair(existingOperation, operation)) {
      discardedOperationIds.add(existingOperation.operationId);
      discardedOperationIds.add(operation.operationId);
      coalescedOperations[existingIndex] = null;
      latestPendingIndexByEntity.delete(entityKey);
      continue;
    }

    if (operation.operationType === "delete" && isSupersededByDelete(existingOperation)) {
      discardedOperationIds.add(existingOperation.operationId);
      coalescedOperations[existingIndex] = operation;
      latestPendingIndexByEntity.set(entityKey, existingIndex);
      continue;
    }

    if (shouldReplaceExistingOperation(existingOperation, operation)) {
      discardedOperationIds.add(existingOperation.operationId);
      coalescedOperations[existingIndex] = operation;
      latestPendingIndexByEntity.set(entityKey, existingIndex);
      continue;
    }

    coalescedOperations.push(operation);
    latestPendingIndexByEntity.set(entityKey, coalescedOperations.length - 1);
  }

  return {
    operations: coalescedOperations.filter((operation): operation is LocalOutboxOperation => operation !== null),
    discardedOperationIds: Array.from(discardedOperationIds),
  };
}
