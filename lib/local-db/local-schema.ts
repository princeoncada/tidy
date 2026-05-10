export type LocalSyncStatus = "local" | "pending" | "syncing" | "synced" | "failed";

export type LocalViewType = "ALL_LISTS" | "UNTAGGED" | "CUSTOM";

export type LocalViewMatchMode = "ALL" | "ANY";

export type LocalTagColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

export type LocalEntityBase = {
  clientId: string;
  serverId: string | null;
  userId: string;
  syncStatus: LocalSyncStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastSyncedAt: string | null;
};

export type LocalView = LocalEntityBase & {
  name: string;
  order: number;
  type: LocalViewType;
  isDefault: boolean;
  matchMode: LocalViewMatchMode;
};

export type LocalList = LocalEntityBase & {
  name: string;
};

export type LocalListItem = LocalEntityBase & {
  name: string;
  completed: boolean;
  order: number;
  notes: string | null;
  listClientId: string;
  listServerId: string | null;
};

export type LocalTag = LocalEntityBase & {
  name: string;
  color: LocalTagColor;
};

export type LocalViewTag = LocalEntityBase & {
  viewClientId: string;
  viewServerId: string | null;
  tagClientId: string;
  tagServerId: string | null;
};

export type LocalListTag = LocalEntityBase & {
  listClientId: string;
  listServerId: string | null;
  tagClientId: string;
  tagServerId: string | null;
};

export type LocalViewList = LocalEntityBase & {
  viewClientId: string;
  viewServerId: string | null;
  listClientId: string;
  listServerId: string | null;
  order: number;
};

export type LocalDbMetadata = {
  key: string;
  value: string;
  updatedAt: string;
};
