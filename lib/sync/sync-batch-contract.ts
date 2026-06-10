import {
  isLocalOutboxOperation,
  type LocalJsonValue,
  type LocalOutboxEntityType,
  type LocalOutboxOperation,
} from "@/lib/local-db/outbox-schema";
import {
  SYNC_ENDPOINT_MAX_PAYLOAD_BYTES,
  validateSyncEndpointRequest,
} from "@/lib/sync/sync-endpoint-contract";

export const SYNC_BATCH_MAX_OPERATIONS = 100;
export const SYNC_BATCH_MAX_TOTAL_BYTES = 200_000;

export type SyncBatchOperation = {
  operation: LocalOutboxOperation;
  idempotencyKey: string;
};

export type SyncBatchRequest = {
  operations: SyncBatchOperation[];
};

export type SyncBatchOperationDecision =
  | {
      operationId: string;
      idempotencyKey: string;
      accepted: true;
      operation: LocalOutboxOperation;
    }
  | {
      operationId: string;
      idempotencyKey: string;
      accepted: false;
      errors: string[];
    };

export type SyncBatchValidationResult =
  | {
      ok: true;
      decisions: SyncBatchOperationDecision[];
    }
  | {
      ok: false;
      errors: string[];
    };

type ParentReference = {
  entityType: LocalOutboxEntityType;
  clientId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadByteSize(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    return 0;
  }
}

function getOperationId(value: unknown, index: number): string {
  if (isRecord(value) && isRecord(value.operation) && typeof value.operation.operationId === "string") {
    return value.operation.operationId;
  }

  return `batch-operation-${index}`;
}

function getIdempotencyKey(value: unknown): string {
  return isRecord(value) && typeof value.idempotencyKey === "string"
    ? value.idempotencyKey
    : "";
}

function getString(payload: LocalJsonValue, ...keys: string[]): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function getParentReferences(operation: LocalOutboxOperation): ParentReference[] {
  if (operation.entityServerId) {
    return [];
  }

  const references: ParentReference[] = [];
  const addReference = (entityType: LocalOutboxEntityType, clientId: string | null) => {
    if (clientId) {
      references.push({ entityType, clientId });
    }
  };

  if (operation.entityType === "listItem" && operation.operationType === "create") {
    addReference("list", getString(operation.payload, "listId", "listClientId"));
  }

  if (operation.entityType === "listItem" && operation.operationType === "move") {
    addReference("list", getString(operation.payload, "toListClientId", "listId", "listClientId"));
  }

  if (operation.entityType === "listTag" && operation.operationType === "attach") {
    addReference("list", getString(operation.payload, "listId", "listClientId"));
    addReference("tag", getString(operation.payload, "tagId", "tagClientId"));
  }

  if (operation.entityType === "viewTag" && operation.operationType === "attach") {
    addReference("view", getString(operation.payload, "viewId", "viewClientId"));
    addReference("tag", getString(operation.payload, "tagId", "tagClientId"));
  }

  if (operation.entityType === "viewList" && operation.operationType === "attach") {
    addReference("view", getString(operation.payload, "viewId", "viewClientId"));
    addReference("list", getString(operation.payload, "listId", "listClientId"));
  }

  return references;
}

function getCreateKey(entityType: LocalOutboxEntityType, clientId: string): string {
  return `${entityType}:${clientId}`;
}

function validateDependencyOrder(
  decisions: SyncBatchOperationDecision[],
  entries: unknown[],
): SyncBatchOperationDecision[] {
  const createIndexes = new Map<
    string,
    Array<{ index: number; accepted: boolean }>
  >();

  entries.forEach((entry, index) => {
    if (
      !isRecord(entry) ||
      !isLocalOutboxOperation(entry.operation) ||
      entry.operation.operationType !== "create"
    ) {
      return;
    }

    const key = getCreateKey(
      entry.operation.entityType,
      entry.operation.entityClientId,
    );
    const indexes = createIndexes.get(key) ?? [];
    indexes.push({
      index,
      accepted: decisions[index]?.accepted === true,
    });
    createIndexes.set(key, indexes);
  });

  return decisions.map((decision, index) => {
    if (!decision.accepted) {
      return decision;
    }

    const errors = new Set<string>();

    for (const reference of getParentReferences(decision.operation)) {
      const indexes = createIndexes.get(
        getCreateKey(reference.entityType, reference.clientId),
      );

      if (!indexes || indexes.length === 0) {
        continue;
      }

      if (indexes.some((create) => create.accepted && create.index < index)) {
        continue;
      }

      if (indexes.some((create) => create.accepted && create.index > index)) {
        errors.add("Dependency not satisfied: parent created later in batch.");
      } else {
        errors.add("Dependency not satisfied: parent create was rejected.");
      }
    }

    if (errors.size === 0) {
      return decision;
    }

    return {
      operationId: decision.operationId,
      idempotencyKey: decision.idempotencyKey,
      accepted: false,
      errors: [...errors],
    };
  });
}

export function validateSyncBatchRequest(
  input: unknown,
  context: { authenticatedUserId: string },
): SyncBatchValidationResult {
  const errors: string[] = [];

  if (
    typeof context.authenticatedUserId !== "string" ||
    context.authenticatedUserId.length === 0
  ) {
    errors.push("Authenticated user id is required.");
  }

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [...errors, "Sync batch request must be an object."],
    };
  }

  if (!Array.isArray(input.operations) || input.operations.length === 0) {
    errors.push("Sync batch operations must be a non-empty array.");
  } else {
    if (input.operations.length > SYNC_BATCH_MAX_OPERATIONS) {
      errors.push("Sync batch exceeds the operation count limit.");
    }

    const totalPayloadBytes = input.operations.reduce((total, entry) => {
      if (!isRecord(entry) || !isRecord(entry.operation)) {
        return total;
      }

      return total + getPayloadByteSize(entry.operation.payload);
    }, 0);

    if (totalPayloadBytes > SYNC_BATCH_MAX_TOTAL_BYTES) {
      errors.push("Sync batch exceeds the total payload size limit.");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const operations = input.operations as unknown[];
  const seenIdempotencyKeys = new Set<string>();
  const decisions = operations.map<SyncBatchOperationDecision>((entry, index) => {
    const operationId = getOperationId(entry, index);
    const idempotencyKey = getIdempotencyKey(entry);
    const validation = validateSyncEndpointRequest(entry, {
      authenticatedUserId: context.authenticatedUserId,
      maxPayloadBytes: SYNC_ENDPOINT_MAX_PAYLOAD_BYTES,
    });
    const operationErrors = validation.ok ? [] : [...validation.errors];

    if (idempotencyKey.length > 0) {
      if (seenIdempotencyKeys.has(idempotencyKey)) {
        operationErrors.push("Duplicate idempotency key in batch.");
      } else {
        seenIdempotencyKeys.add(idempotencyKey);
      }
    }

    if (!validation.ok || operationErrors.length > 0) {
      return {
        operationId,
        idempotencyKey,
        accepted: false,
        errors: operationErrors,
      };
    }

    return {
      operationId: validation.request.operation.operationId,
      idempotencyKey: validation.request.idempotencyKey,
      accepted: true,
      operation: validation.request.operation,
    };
  });

  return {
    ok: true,
    decisions: validateDependencyOrder(decisions, operations),
  };
}
