import { db } from "@/lib/db";
import {
  ensureAllListsView,
  ensureDefaultView,
} from "@/trpc/routers/viewHelpers";

export async function readViewsForUser(userId: string) {
  await ensureDefaultView(userId);

  return db.view.findMany({
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
}

export async function readViewSnapshotForUser(
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
        select: { listId: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!view) return null;

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
    })),
  };
}

export async function readAllListsSnapshotForUser(userId: string) {
  const allListsView = await ensureAllListsView(userId);
  return readViewSnapshotForUser(userId, allListsView.id);
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

