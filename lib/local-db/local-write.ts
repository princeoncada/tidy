import { coalesceOutboxOperations } from "./outbox-coalescing";
import {
  createLocalEntityBase,
  createLocalTimestamp,
  createOutboxOperation,
  getLocalDbOrThrow,
  markEntityPending,
} from "./local-repositories";
import type {
  LocalJsonValue,
  LocalOutboxEntityType,
  LocalOutboxOperation,
  LocalOutboxOperationType,
} from "./outbox-schema";
import type { TidyLocalDatabase } from "./tidy-db";

type LocalWriteIntent = {
  userId: string;
  entityType: LocalOutboxEntityType;
  entityClientId: string;
  operationType: LocalOutboxOperationType;
  payload: LocalJsonValue;
};

export type CommitLocalListCreateArgs = {
  userId: string;
  listId: string;
  name: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListRenameArgs = {
  userId: string;
  listId: string;
  name: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListDeleteArgs = {
  userId: string;
  listId: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListReorderArgs = {
  userId: string;
  viewId: string;
  orderedListIds: string[];
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemCreateArgs = {
  userId: string;
  itemId: string;
  listId: string;
  name: string;
  order: number;
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemRenameArgs = {
  userId: string;
  itemId: string;
  name: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemCompletionArgs = {
  userId: string;
  itemId: string;
  completed: boolean;
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemDeleteArgs = {
  userId: string;
  itemId: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemReorderArgs = {
  userId: string;
  listId: string;
  orderedItemIds: string[];
  db?: TidyLocalDatabase;
};

export type CommitLocalListItemMoveArgs = {
  userId: string;
  itemId: string;
  toListId: string;
  order: number;
  db?: TidyLocalDatabase;
};

export type CommitLocalViewReorderArgs = {
  userId: string;
  orderedViewIds: string[];
  db?: TidyLocalDatabase;
};

let lastMovementTimestampMs = 0;

function createMovementTimestamp(): string {
  const timestampMs = Math.max(Date.now(), lastMovementTimestampMs + 1);
  lastMovementTimestampMs = timestampMs;
  return new Date(timestampMs).toISOString();
}

async function appendCoalescedOutbox(
  db: TidyLocalDatabase,
  intent: LocalWriteIntent,
  now: string,
): Promise<void> {
  const operation = createOutboxOperation({
    ...intent,
    entityServerId: null,
    createdAt: now,
    updatedAt: now,
  });
  const existing = await db.outboxOperations
    .where("[entityType+entityClientId]")
    .equals([intent.entityType, intent.entityClientId])
    .sortBy("createdAt");
  const pending = existing.filter((candidate) => candidate.status === "pending");
  const { operations, discardedOperationIds } = coalesceOutboxOperations([
    ...pending,
    operation,
  ]);

  if (discardedOperationIds.length > 0) {
    await db.outboxOperations.bulkDelete(discardedOperationIds);
  }

  for (const survivor of operations as LocalOutboxOperation[]) {
    await db.outboxOperations.put(survivor);
  }
}

export async function commitLocalListCreate({
  userId,
  listId,
  name,
  db = getLocalDbOrThrow(),
}: CommitLocalListCreateArgs): Promise<void> {
  await db.transaction("rw", [db.lists, db.outboxOperations], async () => {
    const now = createLocalTimestamp();

    await db.lists.put({
      ...createLocalEntityBase({
        clientId: listId,
        userId,
        syncStatus: "local",
        createdAt: now,
        updatedAt: now,
      }),
      name,
    });
    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "list",
        entityClientId: listId,
        operationType: "create",
        payload: { name },
      },
      now,
    );
  });
}

export async function commitLocalListRename({
  userId,
  listId,
  name,
  db = getLocalDbOrThrow(),
}: CommitLocalListRenameArgs): Promise<void> {
  await db.transaction("rw", [db.lists, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.lists.get(listId);

    if (existing) {
      await db.lists.put(markEntityPending({ ...existing, name }, now));
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "list",
        entityClientId: listId,
        operationType: "update",
        payload: { name },
      },
      now,
    );
  });
}

export async function commitLocalListDelete({
  userId,
  listId,
  db = getLocalDbOrThrow(),
}: CommitLocalListDeleteArgs): Promise<void> {
  await db.transaction("rw", [db.lists, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.lists.get(listId);

    if (existing) {
      await db.lists.put({
        ...markEntityPending(existing, now),
        deletedAt: now,
      });
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "list",
        entityClientId: listId,
        operationType: "delete",
        payload: {},
      },
      now,
    );
  });
}

export async function commitLocalListReorder({
  userId,
  viewId,
  orderedListIds,
  db = getLocalDbOrThrow(),
}: CommitLocalListReorderArgs): Promise<void> {
  await db.transaction("rw", [db.viewLists, db.outboxOperations], async () => {
    const now = createMovementTimestamp();

    for (const [order, listId] of orderedListIds.entries()) {
      const existing = await db.viewLists
        .where("[viewClientId+listClientId]")
        .equals([viewId, listId])
        .first();

      if (existing) {
        await db.viewLists.put(
          markEntityPending({ ...existing, order }, now),
        );
      }
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "viewList",
        entityClientId: viewId,
        operationType: "reorder",
        payload: { viewId, orderedIds: orderedListIds },
      },
      now,
    );
  });
}

export async function commitLocalListItemCreate({
  userId,
  itemId,
  listId,
  name,
  order,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemCreateArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createLocalTimestamp();

    await db.listItems.put({
      ...createLocalEntityBase({
        clientId: itemId,
        userId,
        syncStatus: "local",
        createdAt: now,
        updatedAt: now,
      }),
      name,
      completed: false,
      order,
      notes: null,
      listClientId: listId,
      listServerId: null,
    });
    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: itemId,
        operationType: "create",
        payload: { name, listId, order },
      },
      now,
    );
  });
}

export async function commitLocalListItemRename({
  userId,
  itemId,
  name,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemRenameArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.listItems.get(itemId);

    if (existing) {
      await db.listItems.put(markEntityPending({ ...existing, name }, now));
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: itemId,
        operationType: "update",
        payload: { name },
      },
      now,
    );
  });
}

export async function commitLocalListItemCompletion({
  userId,
  itemId,
  completed,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemCompletionArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.listItems.get(itemId);

    if (existing) {
      await db.listItems.put(
        markEntityPending({ ...existing, completed }, now),
      );
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: itemId,
        operationType: "update",
        payload: { completed },
      },
      now,
    );
  });
}

export async function commitLocalListItemDelete({
  userId,
  itemId,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemDeleteArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.listItems.get(itemId);

    if (existing) {
      await db.listItems.put({
        ...markEntityPending(existing, now),
        deletedAt: now,
      });
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: itemId,
        operationType: "delete",
        payload: {},
      },
      now,
    );
  });
}

export async function commitLocalListItemReorder({
  userId,
  listId,
  orderedItemIds,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemReorderArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createMovementTimestamp();

    for (const [order, itemId] of orderedItemIds.entries()) {
      const existing = await db.listItems.get(itemId);

      if (existing && existing.listClientId === listId) {
        await db.listItems.put(
          markEntityPending({ ...existing, order }, now),
        );
      }
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: listId,
        operationType: "reorder",
        payload: { listId, orderedIds: orderedItemIds },
      },
      now,
    );
  });
}

export async function commitLocalListItemMove({
  userId,
  itemId,
  toListId,
  order,
  db = getLocalDbOrThrow(),
}: CommitLocalListItemMoveArgs): Promise<void> {
  await db.transaction("rw", [db.listItems, db.outboxOperations], async () => {
    const now = createMovementTimestamp();
    const existing = await db.listItems.get(itemId);

    if (existing) {
      await db.listItems.put(
        markEntityPending(
          {
            ...existing,
            listClientId: toListId,
            order,
          },
          now,
        ),
      );
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "listItem",
        entityClientId: itemId,
        operationType: "move",
        payload: { toListClientId: toListId, order },
      },
      now,
    );
  });
}

export async function commitLocalViewReorder({
  userId,
  orderedViewIds,
  db = getLocalDbOrThrow(),
}: CommitLocalViewReorderArgs): Promise<void> {
  await db.transaction("rw", [db.views, db.outboxOperations], async () => {
    const now = createMovementTimestamp();

    for (const [order, viewId] of orderedViewIds.entries()) {
      const existing = await db.views.get(viewId);

      if (existing) {
        await db.views.put(
          markEntityPending({ ...existing, order }, now),
        );
      }
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "view",
        entityClientId: "view-order",
        operationType: "reorder",
        payload: { orderedIds: orderedViewIds },
      },
      now,
    );
  });
}
