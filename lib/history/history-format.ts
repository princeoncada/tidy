export interface MutationLedgerEntryInput {
  id: string;
  name: string;
  affectedListIds: string[];
  createdAt: Date | string;
}

export interface FormattedMutationLedgerEntry {
  id: string;
  title: string;
  detail: string;
  affectedListCount: number;
  at: string;
}

const MUTATION_TITLE_OVERRIDES: Record<string, string> = {
  createList: "Create List",
  renameList: "Rename List",
  deleteList: "Delete List",
  reorderLists: "Reorder Lists",
  createItem: "Create Item",
  updateItem: "Update Item",
  deleteItem: "Delete Item",
  reorderItems: "Reorder Items",
  moveItem: "Move Item",
  createTag: "Create Tag",
  updateTag: "Update Tag",
  deleteTag: "Delete Tag",
  attachListTag: "Attach List Tag",
  detachListTag: "Detach List Tag",
  createView: "Create View",
  updateView: "Update View",
  deleteView: "Delete View",
  reorderViews: "Reorder Views",
  reorderViewLists: "Reorder View Lists",
  moveViewList: "Move View List",
  attachViewList: "Attach View List",
  detachViewList: "Detach View List",
  attachViewTag: "Attach View Tag",
  detachViewTag: "Detach View Tag",
  setSelectedView: "Set Selected View",
};

export function humanizeMutationName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Change";

  const override = MUTATION_TITLE_OVERRIDES[trimmed];
  if (override) return override;

  const words = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "Change";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatMutationLedgerEntry(
  entry: MutationLedgerEntryInput,
): FormattedMutationLedgerEntry {
  const affectedListCount = entry.affectedListIds.length;
  const detail =
    affectedListCount === 0
      ? "No lists affected"
      : affectedListCount === 1
        ? "1 list affected"
        : `${affectedListCount} lists affected`;

  return {
    id: entry.id,
    title: humanizeMutationName(entry.name),
    detail,
    affectedListCount,
    at: entry.createdAt instanceof Date
      ? entry.createdAt.toISOString()
      : entry.createdAt,
  };
}
