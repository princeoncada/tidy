import Dexie, { type Table } from "dexie";

import type {
  LocalDbMetadata,
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "./local-schema";
import type { LocalOutboxOperation } from "./outbox-schema";

export const TIDY_LOCAL_DB_NAME = "tidy-local-db";

class TidyLocalDb extends Dexie {
  views!: Table<LocalView, string>;
  lists!: Table<LocalList, string>;
  listItems!: Table<LocalListItem, string>;
  tags!: Table<LocalTag, string>;
  viewTags!: Table<LocalViewTag, string>;
  listTags!: Table<LocalListTag, string>;
  viewLists!: Table<LocalViewList, string>;
  outboxOperations!: Table<LocalOutboxOperation, string>;
  metadata!: Table<LocalDbMetadata, string>;

  constructor() {
    super(TIDY_LOCAL_DB_NAME);

    // Foundation-only schema. Future checkpoints will add repositories and app integration.
    this.version(1).stores({
      views:
        "clientId, serverId, userId, syncStatus, updatedAt, deletedAt, [userId+serverId], [userId+syncStatus], [userId+type], [userId+order]",
      lists:
        "clientId, serverId, userId, syncStatus, updatedAt, deletedAt, [userId+serverId], [userId+syncStatus]",
      listItems:
        "clientId, serverId, userId, listClientId, listServerId, syncStatus, updatedAt, deletedAt, [userId+serverId], [userId+syncStatus], [userId+listClientId], [listClientId+order]",
      tags:
        "clientId, serverId, userId, syncStatus, updatedAt, deletedAt, [userId+serverId], [userId+syncStatus], [userId+name]",
      viewTags:
        "clientId, serverId, userId, viewClientId, viewServerId, tagClientId, tagServerId, syncStatus, updatedAt, deletedAt, [userId+syncStatus], [viewClientId+tagClientId], [tagClientId+viewClientId]",
      listTags:
        "clientId, serverId, userId, listClientId, listServerId, tagClientId, tagServerId, syncStatus, updatedAt, deletedAt, [userId+syncStatus], [listClientId+tagClientId], [tagClientId+listClientId]",
      viewLists:
        "clientId, serverId, userId, viewClientId, viewServerId, listClientId, listServerId, syncStatus, updatedAt, deletedAt, [userId+syncStatus], [viewClientId+listClientId], [listClientId+viewClientId], [viewClientId+order]",
      outboxOperations:
        "operationId, userId, status, entityType, entityClientId, entityServerId, createdAt, updatedAt, retryCount, lastAttemptedAt, idempotencyKey, [userId+status], [entityType+entityClientId]",
      metadata: "key",
    });
  }
}

export type TidyLocalDatabase = TidyLocalDb;

export const tidyLocalDb: TidyLocalDatabase | null =
  typeof window === "undefined" ? null : new TidyLocalDb();
