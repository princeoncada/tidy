import type { LocalOutboxOperation } from "@/lib/local-db/outbox-schema";

export type SyncServerEntitySnapshot = {
  entityServerId: string | null;
  updatedAt: string | null;
};

export type SyncConflictResolution = {
  resolution: "apply" | "skip";
  winner: "client" | "server";
  reason: string;
};

function parseTimestamp(value: string | null): number | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function resolveOutboxOperationConflict(args: {
  operation: Pick<LocalOutboxOperation, "updatedAt">;
  serverSnapshot: SyncServerEntitySnapshot | null;
}): SyncConflictResolution {
  const { operation, serverSnapshot } = args;

  if (serverSnapshot === null) {
    return {
      resolution: "apply",
      winner: "client",
      reason: "No server record exists; client operation applies.",
    };
  }

  const clientTime = parseTimestamp(operation.updatedAt);
  const serverTime = parseTimestamp(serverSnapshot.updatedAt);

  if (serverTime === null || clientTime === null) {
    return {
      resolution: "skip",
      winner: "server",
      reason:
        "Server is authoritative when either timestamp is missing or unparseable.",
    };
  }

  if (clientTime > serverTime) {
    return {
      resolution: "apply",
      winner: "client",
      reason: "Client operation is newer than server state (last-write-wins).",
    };
  }

  return {
    resolution: "skip",
    winner: "server",
    reason:
      "Server state is newer than or equal to the client operation (server-wins tie-break).",
  };
}
