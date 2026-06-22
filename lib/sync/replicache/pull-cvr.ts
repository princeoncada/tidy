import { createHash } from "node:crypto";
import type { PatchOperation, ReadonlyJSONValue } from "replicache";

import type {
  readReplicacheAllListsSnapshotForUser,
  readReplicacheViewsForUser,
  readTagsForUser,
} from "@/lib/dashboard/server-read";
import type { ShareRole } from "@/lib/sync/permissions";
import { initialKeys } from "@/lib/sync/fractional-index";
import { replicacheKeys } from "@/lib/sync/replicache/keys";

type ServerViews = Awaited<ReturnType<typeof readReplicacheViewsForUser>>;
type ServerAllLists = NonNullable<
  Awaited<ReturnType<typeof readReplicacheAllListsSnapshotForUser>>
>;
type ServerAllListsWithRoles = Omit<ServerAllLists, "lists"> & {
  lists: Array<
    ServerAllLists["lists"][number] & {
      accessRole?: ShareRole;
    }
  >;
};
type ServerTags = Awaited<ReturnType<typeof readTagsForUser>>;

export type ReplicacheClientViewEntry = {
  hash: string;
  value: ReadonlyJSONValue;
};

export type ReplicacheClientView = Record<
  string,
  ReplicacheClientViewEntry
>;

export type ReplicacheClientViewRecordHashes = Record<string, string>;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function hashValue(value: ReadonlyJSONValue) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function put(
  target: ReplicacheClientView,
  key: string,
  value: ReadonlyJSONValue,
) {
  target[key] = {
    hash: hashValue(value),
    value,
  };
}

function asArray<T>(value: readonly T[] | null | undefined): readonly T[] {
  return value ?? [];
}

export function buildReplicacheClientView({
  views,
  allLists,
  tags,
}: {
  views: ServerViews;
  allLists: ServerAllListsWithRoles;
  tags: ServerTags;
}): ReplicacheClientView {
  const entities: ReplicacheClientView = {};

  for (const list of allLists.lists) {
    const listItems = asArray(list.listItems);
    const listTags = asArray(list.listTags);
    const itemFallbackKeys = initialKeys(listItems.length);
    put(entities, replicacheKeys.list(list.id), {
      id: list.id,
      userId: list.userId,
      name: list.name,
      workspaceId: list.workspaceId ?? null,
      accessRole: list.accessRole ?? "OWNER",
      createdAt: toIso(list.createdAt),
      updatedAt: toIso(list.updatedAt),
    });

    for (const [index, item] of listItems.entries()) {
      put(entities, replicacheKeys.listItem(item.id), {
        id: item.id,
        name: item.name,
        completed: item.completed,
        order: item.orderKey ?? itemFallbackKeys[index],
        notes: item.notes,
        listId: item.listId,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      });
    }

    for (const listTag of listTags) {
      put(entities, replicacheKeys.listTag(list.id, listTag.tagId), {
        listId: list.id,
        tagId: listTag.tagId,
      });
    }
  }

  for (const tag of tags) {
    put(entities, replicacheKeys.tag(tag.id), {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      userId: tag.userId,
      createdAt: toIso(tag.createdAt),
      updatedAt: toIso(tag.updatedAt),
    });
  }

  const viewFallbackKeys = initialKeys(views.length);
  for (const [viewIndex, view] of views.entries()) {
    put(entities, replicacheKeys.view(view.id), {
      id: view.id,
      name: view.name,
      order: view.orderKey ?? viewFallbackKeys[viewIndex],
      userId: view.userId,
      type: view.type,
      isDefault: view.isDefault,
      matchMode: view.matchMode,
      createdAt: toIso(view.createdAt),
      updatedAt: toIso(view.updatedAt),
    });

    const viewLists = asArray(view.viewLists);
    const viewTags = asArray(view.viewTags);
    const viewListFallbackKeys = initialKeys(viewLists.length);
    for (const [viewListIndex, viewList] of viewLists.entries()) {
      put(
        entities,
        replicacheKeys.viewList(view.id, viewList.listId),
        {
          viewId: view.id,
          listId: viewList.listId,
          order:
            viewList.orderKey ?? viewListFallbackKeys[viewListIndex],
        },
      );
    }

    for (const viewTag of viewTags) {
      put(entities, replicacheKeys.viewTag(view.id, viewTag.tagId), {
        viewId: view.id,
        tagId: viewTag.tagId,
      });
    }
  }

  const selectedView =
    views.find((view) => view.isDefault) ??
    views.find((view) => view.type === "ALL_LISTS");
  if (selectedView) {
    put(entities, replicacheKeys.selectedView, selectedView.id);
  }

  return entities;
}

export function toReplicacheClientViewRecordHashes(
  view: ReplicacheClientView,
): ReplicacheClientViewRecordHashes {
  return Object.fromEntries(
    Object.entries(view).map(([key, entry]) => [key, entry.hash]),
  );
}

export function diffReplicacheClientViews({
  previous,
  current,
}: {
  previous: ReplicacheClientViewRecordHashes;
  current: ReplicacheClientView;
}): PatchOperation[] {
  const patch: PatchOperation[] = [];

  for (const [key, entry] of Object.entries(current).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (previous[key] !== entry.hash) {
      patch.push({ op: "put", key, value: entry.value });
    }
  }

  for (const key of Object.keys(previous).sort()) {
    if (!(key in current)) {
      patch.push({ op: "del", key });
    }
  }

  return patch;
}

const COOKIE_SEQUENCE_WIDTH = 16;

export function nextReplicacheCookie(
  latestCookie: string | null | undefined,
  clientGroupID = "",
) {
  const suffix = latestCookie?.split(":").at(-1);
  const parsed = Number(suffix);
  const next = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed + 1 : 1;
  const sequence = String(next).padStart(COOKIE_SEQUENCE_WIDTH, "0");
  return clientGroupID ? `${clientGroupID}:${sequence}` : sequence;
}
