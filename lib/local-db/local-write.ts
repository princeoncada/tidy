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
import type { LocalTagColor } from "./local-schema";
import type { TidyLocalDatabase } from "./tidy-db";
import { notifyOutboxCaptured } from "@/lib/sync/outbox-capture-events";

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
  inheritedTagIds?: string[];
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

export type CommitLocalTagCreateArgs = {
  userId: string;
  tagId: string;
  name: string;
  color: LocalTagColor;
  db?: TidyLocalDatabase;
};

export type CommitLocalTagUpdateArgs = {
  userId: string;
  tagId: string;
  name?: string;
  color?: LocalTagColor;
  db?: TidyLocalDatabase;
};

export type CommitLocalTagDeleteArgs = {
  userId: string;
  tagId: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalListTagChangesArgs = {
  userId: string;
  listId: string;
  operations: Array<{
    tagId: string;
    action: "add" | "remove";
  }>;
  db?: TidyLocalDatabase;
};

export type CommitLocalViewCreateArgs = {
  userId: string;
  viewId: string;
  name: string;
  tagIds: string[];
  matchMode?: "ALL" | "ANY";
  db?: TidyLocalDatabase;
};

export type CommitLocalViewUpdateArgs = {
  userId: string;
  viewId: string;
  name?: string;
  tagIds?: string[];
  matchMode?: "ALL" | "ANY";
  db?: TidyLocalDatabase;
};

export type CommitLocalViewDeleteArgs = {
  userId: string;
  viewId: string;
  db?: TidyLocalDatabase;
};

export type CommitLocalSelectedViewArgs = {
  userId: string;
  viewId: string;
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

  notifyOutboxCaptured({ userId: intent.userId });
}

export async function commitLocalListCreate({
  userId,
  listId,
  name,
  inheritedTagIds = [],
  db = getLocalDbOrThrow(),
}: CommitLocalListCreateArgs): Promise<void> {
  await db.transaction(
    "rw",
    [db.lists, db.listTags, db.outboxOperations],
    async () => {
      const now = createLocalTimestamp();
      const uniqueTagIds = [...new Set(inheritedTagIds)];

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
      for (const tagId of uniqueTagIds) {
        const entityClientId = `${listId}:${tagId}`;
        await db.listTags.put({
          ...createLocalEntityBase({
            clientId: entityClientId,
            userId,
            syncStatus: "local",
            createdAt: now,
            updatedAt: now,
          }),
          listClientId: listId,
          listServerId: null,
          tagClientId: tagId,
          tagServerId: null,
        });
      }
      await appendCoalescedOutbox(
        db,
        {
          userId,
          entityType: "list",
          entityClientId: listId,
          operationType: "create",
          payload: {
            name,
            ...(uniqueTagIds.length > 0 ? { tagIds: uniqueTagIds } : {}),
          },
        },
        now,
      );
    },
  );
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
        payload: { deleted: true },
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
        payload: { deleted: true },
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

export async function commitLocalTagCreate({
  userId,
  tagId,
  name,
  color,
  db = getLocalDbOrThrow(),
}: CommitLocalTagCreateArgs): Promise<void> {
  await db.transaction("rw", [db.tags, db.outboxOperations], async () => {
    const now = createLocalTimestamp();

    await db.tags.put({
      ...createLocalEntityBase({
        clientId: tagId,
        userId,
        syncStatus: "local",
        createdAt: now,
        updatedAt: now,
      }),
      name,
      color,
    });
    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "tag",
        entityClientId: tagId,
        operationType: "create",
        payload: { name, color },
      },
      now,
    );
  });
}

export async function commitLocalTagUpdate({
  userId,
  tagId,
  name,
  color,
  db = getLocalDbOrThrow(),
}: CommitLocalTagUpdateArgs): Promise<void> {
  await db.transaction("rw", [db.tags, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.tags.get(tagId);

    if (existing) {
      await db.tags.put(
        markEntityPending(
          {
            ...existing,
            ...(name !== undefined ? { name } : {}),
            ...(color !== undefined ? { color } : {}),
          },
          now,
        ),
      );
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "tag",
        entityClientId: tagId,
        operationType: "update",
        payload: {
          ...(name !== undefined ? { name } : {}),
          ...(color !== undefined ? { color } : {}),
        },
      },
      now,
    );
  });
}

export async function commitLocalTagDelete({
  userId,
  tagId,
  db = getLocalDbOrThrow(),
}: CommitLocalTagDeleteArgs): Promise<void> {
  await db.transaction("rw", [db.tags, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.tags.get(tagId);

    if (existing) {
      await db.tags.put({
        ...markEntityPending(existing, now),
        deletedAt: now,
      });
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "tag",
        entityClientId: tagId,
        operationType: "delete",
        payload: { deleted: true },
      },
      now,
    );
  });
}

export async function commitLocalListTagChanges({
  userId,
  listId,
  operations,
  db = getLocalDbOrThrow(),
}: CommitLocalListTagChangesArgs): Promise<void> {
  await db.transaction("rw", [db.listTags, db.outboxOperations], async () => {
    const now = createLocalTimestamp();

    for (const operation of operations) {
      const entityClientId = `${listId}:${operation.tagId}`;
      const existing = await db.listTags
        .where("[listClientId+tagClientId]")
        .equals([listId, operation.tagId])
        .first();

      if (operation.action === "add") {
        await db.listTags.put(
          existing
            ? markEntityPending({ ...existing, deletedAt: null }, now)
            : {
                ...createLocalEntityBase({
                  clientId: entityClientId,
                  userId,
                  syncStatus: "local",
                  createdAt: now,
                  updatedAt: now,
                }),
                listClientId: listId,
                listServerId: null,
                tagClientId: operation.tagId,
                tagServerId: null,
              },
        );
        await appendCoalescedOutbox(
          db,
          {
            userId,
            entityType: "listTag",
            entityClientId,
            operationType: "attach",
            payload: { listId, tagId: operation.tagId },
          },
          now,
        );
        continue;
      }

      if (existing) {
        await db.listTags.put({
          ...markEntityPending(existing, now),
          deletedAt: now,
        });
      }
      await appendCoalescedOutbox(
        db,
        {
          userId,
          entityType: "listTag",
          entityClientId,
          operationType: "detach",
          payload: { listId, tagId: operation.tagId },
        },
        now,
      );
    }
  });
}

export async function commitLocalViewCreate({
  userId,
  viewId,
  name,
  tagIds,
  matchMode = "ALL",
  db = getLocalDbOrThrow(),
}: CommitLocalViewCreateArgs): Promise<void> {
  await db.transaction(
    "rw",
    [db.views, db.viewTags, db.outboxOperations],
    async () => {
      const now = createLocalTimestamp();
      const existingViews = await db.views.where("userId").equals(userId).toArray();
      const topOrder = existingViews.length
        ? Math.min(...existingViews.map((view) => view.order)) - 1
        : 0;

      for (const view of existingViews) {
        if (view.isDefault) {
          await db.views.put({ ...view, isDefault: false });
        }
      }

      await db.views.put({
        ...createLocalEntityBase({
          clientId: viewId,
          userId,
          syncStatus: "local",
          createdAt: now,
          updatedAt: now,
        }),
        name,
        order: topOrder,
        type: "CUSTOM",
        isDefault: true,
        matchMode,
      });

      for (const tagId of tagIds) {
        await db.viewTags.put({
          ...createLocalEntityBase({
            clientId: `${viewId}:${tagId}`,
            userId,
            syncStatus: "local",
            createdAt: now,
            updatedAt: now,
          }),
          viewClientId: viewId,
          viewServerId: null,
          tagClientId: tagId,
          tagServerId: null,
        });
      }

      await appendCoalescedOutbox(
        db,
        {
          userId,
          entityType: "view",
          entityClientId: viewId,
          operationType: "create",
          payload: { name, tagIds, matchMode },
        },
        now,
      );
    },
  );
}

export async function commitLocalViewUpdate({
  userId,
  viewId,
  name,
  tagIds,
  matchMode,
  db = getLocalDbOrThrow(),
}: CommitLocalViewUpdateArgs): Promise<void> {
  await db.transaction(
    "rw",
    [db.views, db.viewTags, db.outboxOperations],
    async () => {
      const now = createLocalTimestamp();
      const existing = await db.views.get(viewId);

      if (existing) {
        await db.views.put(
          markEntityPending(
            {
              ...existing,
              ...(name !== undefined ? { name } : {}),
              ...(matchMode !== undefined ? { matchMode } : {}),
            },
            now,
          ),
        );
      }

      if (tagIds !== undefined) {
        const existingViewTags = await db.viewTags
          .where("viewClientId")
          .equals(viewId)
          .toArray();

        for (const viewTag of existingViewTags) {
          await db.viewTags.put({
            ...viewTag,
            deletedAt: now,
            updatedAt: now,
          });
        }

        for (const tagId of tagIds) {
          await db.viewTags.put({
            ...createLocalEntityBase({
              clientId: `${viewId}:${tagId}`,
              userId,
              syncStatus: "local",
              createdAt: now,
              updatedAt: now,
            }),
            viewClientId: viewId,
            viewServerId: null,
            tagClientId: tagId,
            tagServerId: null,
          });
        }
      }

      await appendCoalescedOutbox(
        db,
        {
          userId,
          entityType: "view",
          entityClientId: viewId,
          operationType: "update",
          payload: {
            ...(name !== undefined ? { name } : {}),
            ...(tagIds !== undefined ? { tagIds } : {}),
            ...(matchMode !== undefined ? { matchMode } : {}),
          },
        },
        now,
      );
    },
  );
}

export async function commitLocalViewDelete({
  userId,
  viewId,
  db = getLocalDbOrThrow(),
}: CommitLocalViewDeleteArgs): Promise<void> {
  await db.transaction("rw", [db.views, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const existing = await db.views.get(viewId);

    if (existing) {
      await db.views.put({
        ...markEntityPending(existing, now),
        deletedAt: now,
      });
    }

    if (existing?.isDefault) {
      const views = await db.views.where("userId").equals(userId).toArray();
      const allListsView = views.find((view) => view.type === "ALL_LISTS");

      if (allListsView) {
        await db.views.put({ ...allListsView, isDefault: true });
      }
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "view",
        entityClientId: viewId,
        operationType: "delete",
        payload: { deleted: true },
      },
      now,
    );
  });
}

export async function commitLocalSelectedView({
  userId,
  viewId,
  db = getLocalDbOrThrow(),
}: CommitLocalSelectedViewArgs): Promise<void> {
  await db.transaction("rw", [db.views, db.outboxOperations], async () => {
    const now = createLocalTimestamp();
    const views = await db.views.where("userId").equals(userId).toArray();

    for (const view of views) {
      const isDefault = view.clientId === viewId;

      if (view.isDefault !== isDefault) {
        await db.views.put({ ...view, isDefault });
      }
    }

    await appendCoalescedOutbox(
      db,
      {
        userId,
        entityType: "metadata",
        entityClientId: "selected-view",
        operationType: "update",
        payload: { selectedViewId: viewId },
      },
      now,
    );
  });
}
