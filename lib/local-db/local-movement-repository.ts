import { getLocalDbOrThrow } from "./local-repositories";
import type { LocalOutboxOperation } from "./outbox-schema";
import type { TidyLocalDatabase } from "./tidy-db";

export async function readPendingMovementOperationsForUser(
  userId: string,
  db: TidyLocalDatabase = getLocalDbOrThrow(),
): Promise<LocalOutboxOperation[]> {
  const operations = await db.outboxOperations
    .where("userId")
    .equals(userId)
    .sortBy("createdAt");

  return operations.filter(
    (operation) =>
      ["pending", "syncing", "failed"].includes(operation.status) &&
      ((operation.entityType === "viewList" &&
        operation.operationType === "reorder") ||
        (operation.entityType === "listItem" &&
          ["move", "reorder"].includes(operation.operationType))),
  );
}
