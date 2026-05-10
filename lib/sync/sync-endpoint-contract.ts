import {
  isLocalOutboxOperation,
  type LocalJsonValue,
  type LocalOutboxEntityType,
  type LocalOutboxOperation,
  type LocalOutboxOperationType,
} from "@/lib/local-db/outbox-schema";

export const SYNC_ENDPOINT_MAX_PAYLOAD_BYTES = 10_000;

export type SyncEndpointRequest = {
  operation: LocalOutboxOperation;
  idempotencyKey: string;
};

export type SyncEndpointValidationContext = {
  authenticatedUserId: string;
  maxPayloadBytes?: number;
};

export type SyncEndpointValidationResult =
  | {
      ok: true;
      request: SyncEndpointRequest;
    }
  | {
      ok: false;
      errors: string[];
    };

const ENTITY_OPERATION_MATRIX = {
  view: ["create", "update", "delete", "reorder", "upsert"],
  list: ["create", "update", "delete", "reorder", "move", "upsert"],
  listItem: ["create", "update", "delete", "reorder", "move", "upsert"],
  tag: ["create", "update", "delete", "upsert"],
  viewTag: ["attach", "detach", "upsert", "delete"],
  listTag: ["attach", "detach", "upsert", "delete"],
  viewList: ["attach", "detach", "reorder", "move", "upsert", "delete"],
  metadata: ["update", "upsert"],
} as const satisfies Record<LocalOutboxEntityType, readonly LocalOutboxOperationType[]>;

function isRecord(value: LocalJsonValue): value is Record<string, LocalJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadByteSize(payload: LocalJsonValue): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

function isAllowedEntityOperation(
  entityType: LocalOutboxEntityType,
  operationType: LocalOutboxOperationType,
): boolean {
  return (ENTITY_OPERATION_MATRIX[entityType] as readonly LocalOutboxOperationType[]).includes(operationType);
}

function validateOperationPayload(operation: LocalOutboxOperation): string[] {
  const errors: string[] = [];

  if (!isRecord(operation.payload)) {
    errors.push("Operation payload must be a JSON object.");
    return errors;
  }

  if (operation.operationType === "delete" && Object.keys(operation.payload).length === 0) {
    errors.push("Delete operations must include a non-empty payload for server validation.");
  }

  if (operation.operationType === "move") {
    const hasTarget =
      typeof operation.payload.toListClientId === "string" ||
      typeof operation.payload.toViewClientId === "string" ||
      typeof operation.payload.targetClientId === "string";

    if (!hasTarget) {
      errors.push("Move operations must include a target client id.");
    }
  }

  if (operation.operationType === "reorder") {
    const orderedIds = operation.payload.orderedIds;

    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
      errors.push("Reorder operations must include orderedIds as a string array.");
    }
  }

  return errors;
}

export function validateSyncEndpointRequest(
  input: unknown,
  context: SyncEndpointValidationContext,
): SyncEndpointValidationResult {
  const errors: string[] = [];

  if (typeof context.authenticatedUserId !== "string" || context.authenticatedUserId.length === 0) {
    errors.push("Authenticated user id is required.");
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      errors: [...errors, "Sync endpoint request must be an object."],
    };
  }

  const candidate = input as Record<string, unknown>;
  const operation = candidate.operation;
  const idempotencyKey = candidate.idempotencyKey;

  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    errors.push("Idempotency key is required.");
  }

  if (!isLocalOutboxOperation(operation)) {
    return {
      ok: false,
      errors: [...errors, "Operation is not a valid outbox operation."],
    };
  }

  if (operation.userId !== context.authenticatedUserId) {
    errors.push("Operation user does not match authenticated user.");
  }

  if (operation.idempotencyKey !== idempotencyKey) {
    errors.push("Request idempotency key must match operation idempotency key.");
  }

  if (operation.status !== "syncing" && operation.status !== "pending") {
    errors.push("Only pending or syncing operations can be replayed.");
  }

  if (!isAllowedEntityOperation(operation.entityType, operation.operationType)) {
    errors.push("Operation type is not allowed for entity type.");
  }

  const maxPayloadBytes = context.maxPayloadBytes ?? SYNC_ENDPOINT_MAX_PAYLOAD_BYTES;
  const payloadByteSize = getPayloadByteSize(operation.payload);

  if (payloadByteSize > maxPayloadBytes) {
    errors.push("Operation payload exceeds the sync endpoint size limit.");
  }

  errors.push(...validateOperationPayload(operation));

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    request: {
      operation,
      idempotencyKey: idempotencyKey as string,
    },
  };
}
