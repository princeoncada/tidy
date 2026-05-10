export const testIds = {
  appShell: "app-shell",
  createListButton: "create-list-button",
  listCard: "list-card",
  listTitle: "list-title",
  listTitleInput: "list-title-input",
  listDragHandle: "list-drag-handle",
  listDropZone: "list-drop-zone",
  createItemInput: "create-item-input",
  listItem: "list-item",
  listItemTitle: "list-item-title",
  itemDragHandle: "item-drag-handle",
  deleteListButton: "delete-list-button",
  viewCreateButton: "view-create-button",
  viewCard: "view-card",
  tagSelector: "tag-selector",
  saveViewButton: "save-view-button",
} as const;

export type TestId = (typeof testIds)[keyof typeof testIds];
