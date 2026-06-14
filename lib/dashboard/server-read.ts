import { db } from "@/lib/db";
import {
  ensureAllListsView,
  ensureDefaultView,
} from "@/trpc/routers/viewHelpers";

function omitOrderKey<T extends { orderKey: unknown }>(
  value: T,
): Omit<T, "orderKey"> {
  const legacyValue = { ...value };
  Reflect.deleteProperty(legacyValue, "orderKey");
  return legacyValue;
}

export async function readViewsForUser(userId: string) {
  await ensureDefaultView(userId);

  const views = await db.view.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    include: {
      viewTags: {
        include: {
          tag: true,
        },
      },
      viewLists: {
        select: {
          listId: true,
          order: true,
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  return views.map(omitOrderKey);
}

export async function readViewSnapshotForUser(
  userId: string,
  viewId: string,
) {
  const storedView = await db.view.findFirst({
    where: {
      id: viewId,
      userId,
    },
    include: {
      viewTags: {
        include: { tag: true },
      },
      viewLists: {
        select: { listId: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!storedView) return null;
  const view = omitOrderKey(storedView);

  const viewLists = await db.viewList.findMany({
    where: {
      viewId,
      list: { userId },
    },
    orderBy: { order: "asc" },
    include: {
      list: {
        include: {
          listTags: { include: { tag: true } },
          listItems: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  return {
    view,
    lists: viewLists.map((viewList) => ({
      ...viewList.list,
      order: viewList.order,
      listItems: viewList.list.listItems.map(omitOrderKey),
    })),
  };
}

export async function readAllListsSnapshotForUser(userId: string) {
  const allListsView = await ensureAllListsView(userId);
  return readViewSnapshotForUser(userId, allListsView.id);
}

export async function readReplicacheViewsForUser(userId: string) {
  await ensureDefaultView(userId);

  return db.view.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: {
      viewTags: {
        include: {
          tag: true,
        },
      },
      viewLists: {
        select: {
          listId: true,
          order: true,
          orderKey: true,
        },
        orderBy: [{ order: "asc" }, { listId: "asc" }],
      },
    },
  });
}

async function readReplicacheViewSnapshotForUser(
  userId: string,
  viewId: string,
) {
  const view = await db.view.findFirst({
    where: {
      id: viewId,
      userId,
    },
    include: {
      viewTags: {
        include: { tag: true },
      },
      viewLists: {
        select: {
          listId: true,
          order: true,
          orderKey: true,
        },
        orderBy: [{ order: "asc" }, { listId: "asc" }],
      },
    },
  });

  if (!view) return null;

  const viewLists = await db.viewList.findMany({
    where: {
      viewId,
      list: { userId },
    },
    orderBy: [{ order: "asc" }, { listId: "asc" }],
    include: {
      list: {
        include: {
          listTags: { include: { tag: true } },
          listItems: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });

  return {
    view,
    lists: viewLists.map((viewList) => ({
      ...viewList.list,
      order: viewList.order,
      orderKey: viewList.orderKey,
    })),
  };
}

export async function readReplicacheAllListsSnapshotForUser(userId: string) {
  const allListsView = await ensureAllListsView(userId);
  return readReplicacheViewSnapshotForUser(userId, allListsView.id);
}

export function readTagsForUser(userId: string) {
  return db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      listTags: true,
    },
  });
}

