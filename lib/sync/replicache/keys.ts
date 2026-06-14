export const REPLICACHE_KEY_PREFIXES = {
  list: "list/",
  listItem: "listItem/",
  tag: "tag/",
  view: "view/",
  viewList: "viewList/",
  viewTag: "viewTag/",
  listTag: "listTag/",
} as const;

export const REPLICACHE_SELECTED_VIEW_KEY = "metadata/selectedView";

export const replicacheKeys = {
  list: (id: string) => `${REPLICACHE_KEY_PREFIXES.list}${id}`,
  listItem: (id: string) => `${REPLICACHE_KEY_PREFIXES.listItem}${id}`,
  tag: (id: string) => `${REPLICACHE_KEY_PREFIXES.tag}${id}`,
  view: (id: string) => `${REPLICACHE_KEY_PREFIXES.view}${id}`,
  viewList: (viewId: string, listId: string) =>
    `${REPLICACHE_KEY_PREFIXES.viewList}${viewId}/${listId}`,
  viewTag: (viewId: string, tagId: string) =>
    `${REPLICACHE_KEY_PREFIXES.viewTag}${viewId}/${tagId}`,
  listTag: (listId: string, tagId: string) =>
    `${REPLICACHE_KEY_PREFIXES.listTag}${listId}/${tagId}`,
  selectedView: REPLICACHE_SELECTED_VIEW_KEY,
} as const;

export type ReplicacheListValue = {
  id: string;
  userId: string;
  name: string;
  accessRole?: "OWNER" | "EDITOR" | "VIEWER";
  createdAt: string;
  updatedAt: string;
};

export type ReplicacheListItemValue = {
  id: string;
  name: string;
  completed: boolean;
  order: string;
  notes: string | null;
  listId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReplicacheTagValue = {
  id: string;
  name: string;
  color: "gray" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReplicacheViewValue = {
  id: string;
  name: string;
  order: string;
  userId: string;
  type: "ALL_LISTS" | "UNTAGGED" | "CUSTOM";
  isDefault: boolean;
  matchMode: "ALL" | "ANY";
  createdAt: string;
  updatedAt: string;
};

export type ReplicacheViewListValue = {
  viewId: string;
  listId: string;
  order: string;
};

export type ReplicacheViewTagValue = {
  viewId: string;
  tagId: string;
};

export type ReplicacheListTagValue = {
  listId: string;
  tagId: string;
};

