import type { DashboardSnapshot, ViewsCache } from "@/lib/dashboard-cache";
import {
  mapServerGraphToLocalTags,
  mapServerSnapshotToLocalListItems,
  mapServerSnapshotToLocalLists,
  mapServerSnapshotToLocalListTags,
  mapServerViewsToLocalViewLists,
  mapServerViewsToLocalViews,
  mapServerViewsToLocalViewTags,
} from "@/lib/local-first-dashboard";
import type {
  LocalEntityBase,
  LocalList,
  LocalListItem,
  LocalListTag,
  LocalTag,
  LocalView,
  LocalViewList,
  LocalViewTag,
} from "@/lib/local-db/local-schema";

export type LocalGraphEntityReconcilePlan<T extends LocalEntityBase> = {
  upserts: T[];
  deleteClientIds: string[];
};

export type LocalGraphReconcilePlan = {
  views: LocalGraphEntityReconcilePlan<LocalView>;
  lists: LocalGraphEntityReconcilePlan<LocalList>;
  listItems: LocalGraphEntityReconcilePlan<LocalListItem>;
  tags: LocalGraphEntityReconcilePlan<LocalTag>;
  listTags: LocalGraphEntityReconcilePlan<LocalListTag>;
  viewLists: LocalGraphEntityReconcilePlan<LocalViewList>;
  viewTags: LocalGraphEntityReconcilePlan<LocalViewTag>;
};

export type LocalGraphReconcileArgs = {
  userId: string;
  server: {
    views: ViewsCache;
    allLists: DashboardSnapshot;
  };
  local: {
    views: LocalView[];
    lists: LocalList[];
    listItems: LocalListItem[];
    tags: LocalTag[];
    listTags: LocalListTag[];
    viewLists: LocalViewList[];
    viewTags: LocalViewTag[];
  };
};

function compareLocalEntities(left: LocalEntityBase, right: LocalEntityBase) {
  return left.clientId.localeCompare(right.clientId);
}

function reconcileEntityRows<T extends LocalEntityBase>(
  serverRows: T[],
  localRows: T[],
): LocalGraphEntityReconcilePlan<T> {
  const sortedServerRows = [...serverRows].sort((left, right) => {
    const leftIdentity = left.serverId ?? left.clientId;
    const rightIdentity = right.serverId ?? right.clientId;
    return leftIdentity.localeCompare(rightIdentity) ||
      left.clientId.localeCompare(right.clientId);
  });
  const uniqueServerRows = [
    ...new Map(
      sortedServerRows.map((row) => [row.serverId ?? row.clientId, row]),
    ).values(),
  ];
  const sortedLocalRows = [...localRows].sort(compareLocalEntities);
  const matchedLocalClientIds = new Set<string>();
  const upserts = uniqueServerRows.map((serverRow) => {
    const serverIdMatch = serverRow.serverId
      ? sortedLocalRows.find((localRow) =>
        !matchedLocalClientIds.has(localRow.clientId) &&
        localRow.serverId === serverRow.serverId
      )
      : undefined;
    const clientIdMatch = sortedLocalRows.find((localRow) =>
      !matchedLocalClientIds.has(localRow.clientId) &&
      localRow.clientId === serverRow.clientId
    );
    const matchedLocalRow = serverIdMatch ?? clientIdMatch;

    if (matchedLocalRow) {
      matchedLocalClientIds.add(matchedLocalRow.clientId);
    }

    return {
      ...serverRow,
      clientId: matchedLocalRow?.clientId ?? serverRow.clientId,
    };
  });
  const deleteClientIds = sortedLocalRows
    .filter((localRow) =>
      localRow.syncStatus === "synced" &&
      !matchedLocalClientIds.has(localRow.clientId)
    )
    .map((localRow) => localRow.clientId);

  return {
    upserts: upserts.sort(compareLocalEntities),
    deleteClientIds,
  };
}

function clientIdByServerId<T extends LocalEntityBase>(
  plan: LocalGraphEntityReconcilePlan<T>,
) {
  return new Map(
    plan.upserts.flatMap((row) =>
      row.serverId ? [[row.serverId, row.clientId] as const] : []
    ),
  );
}

function relationshipClientId(...clientIds: string[]) {
  return clientIds.join("::");
}

export function reconcileServerGraphIntoLocalPlan(
  args: LocalGraphReconcileArgs,
): LocalGraphReconcilePlan {
  const views = reconcileEntityRows(
    mapServerViewsToLocalViews(args.server.views, args.userId),
    args.local.views,
  );
  const lists = reconcileEntityRows(
    mapServerSnapshotToLocalLists(args.server.allLists, args.userId),
    args.local.lists,
  );
  const tags = reconcileEntityRows(
    mapServerGraphToLocalTags(
      args.server.views,
      args.server.allLists,
      args.userId,
    ),
    args.local.tags,
  );
  const viewClientIdByServerId = clientIdByServerId(views);
  const listClientIdByServerId = clientIdByServerId(lists);
  const tagClientIdByServerId = clientIdByServerId(tags);
  const listItems = reconcileEntityRows(
    mapServerSnapshotToLocalListItems(args.server.allLists, args.userId)
      .map((item) => ({
        ...item,
        listClientId:
          (item.listServerId &&
            listClientIdByServerId.get(item.listServerId)) ??
          item.listClientId,
      })),
    args.local.listItems,
  );
  const listTags = reconcileEntityRows(
    mapServerSnapshotToLocalListTags(args.server.allLists, args.userId)
      .map((listTag) => {
        const listClientId =
          (listTag.listServerId &&
            listClientIdByServerId.get(listTag.listServerId)) ??
          listTag.listClientId;
        const tagClientId =
          (listTag.tagServerId &&
            tagClientIdByServerId.get(listTag.tagServerId)) ??
          listTag.tagClientId;

        return {
          ...listTag,
          clientId: relationshipClientId(listClientId, tagClientId),
          listClientId,
          tagClientId,
        };
      }),
    args.local.listTags,
  );
  const viewLists = reconcileEntityRows(
    mapServerViewsToLocalViewLists(args.server.views, args.userId)
      .map((viewList) => {
        const viewClientId =
          (viewList.viewServerId &&
            viewClientIdByServerId.get(viewList.viewServerId)) ??
          viewList.viewClientId;
        const listClientId =
          (viewList.listServerId &&
            listClientIdByServerId.get(viewList.listServerId)) ??
          viewList.listClientId;

        return {
          ...viewList,
          clientId: relationshipClientId(viewClientId, listClientId),
          viewClientId,
          listClientId,
        };
      }),
    args.local.viewLists,
  );
  const viewTags = reconcileEntityRows(
    mapServerViewsToLocalViewTags(args.server.views, args.userId)
      .map((viewTag) => {
        const viewClientId =
          (viewTag.viewServerId &&
            viewClientIdByServerId.get(viewTag.viewServerId)) ??
          viewTag.viewClientId;
        const tagClientId =
          (viewTag.tagServerId &&
            tagClientIdByServerId.get(viewTag.tagServerId)) ??
          viewTag.tagClientId;

        return {
          ...viewTag,
          clientId: relationshipClientId(viewClientId, tagClientId),
          viewClientId,
          tagClientId,
        };
      }),
    args.local.viewTags,
  );

  return {
    views,
    lists,
    listItems,
    tags,
    listTags,
    viewLists,
    viewTags,
  };
}
