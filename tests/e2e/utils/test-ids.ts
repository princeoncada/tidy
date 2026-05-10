export const testIds = {
  appShell: "app-shell",
  createListButton: "create-list-button",
  listCard: "list-card",
  listTitle: "list-title",
  listTitleInput: "list-title-input",
  createItemInput: "create-item-input",
  listItem: "list-item",
  listItemTitle: "list-item-title",
  deleteListButton: "delete-list-button",
  viewCreateButton: "view-create-button",
  viewCard: "view-card",
  tagSelector: "tag-selector",
  saveViewButton: "save-view-button",
} as const;

export type TestId = (typeof testIds)[keyof typeof testIds];
