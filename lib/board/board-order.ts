import { keyBetween } from "@/lib/sync/fractional-index";
import type {
  ItemStatus,
  ReplicacheListItemValue,
} from "@/lib/sync/replicache/keys";

export type BoardColumnDefinition = {
  status: ItemStatus;
  label: string;
};

export const BOARD_COLUMNS: ReadonlyArray<BoardColumnDefinition> = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];

export type BoardCardItem = Pick<
  ReplicacheListItemValue,
  "id" | "name" | "listId" | "status" | "boardOrderKey" | "order"
>;

function compareStrings(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compareBoardItems(
  left: BoardCardItem,
  right: BoardCardItem,
): number {
  if (left.boardOrderKey && right.boardOrderKey) {
    return (
      compareStrings(left.boardOrderKey, right.boardOrderKey) ||
      compareStrings(left.id, right.id)
    );
  }

  if (left.boardOrderKey) return -1;
  if (right.boardOrderKey) return 1;

  return (
    compareStrings(left.order, right.order) ||
    compareStrings(left.id, right.id)
  );
}

export function groupItemsByStatus(items: ReadonlyArray<BoardCardItem>) {
  const groups = Object.fromEntries(
    BOARD_COLUMNS.map((column) => [column.status, [] as BoardCardItem[]]),
  ) as Record<ItemStatus, BoardCardItem[]>;

  for (const item of items) {
    groups[item.status].push(item);
  }

  for (const column of BOARD_COLUMNS) {
    groups[column.status].sort(compareBoardItems);
  }

  return groups;
}

export function boardKeyForDrop(
  orderedColumn: ReadonlyArray<BoardCardItem>,
  targetIndex: number,
): string {
  let before: string | null = null;
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const key = orderedColumn[index]?.boardOrderKey;
    if (key) {
      before = key;
      break;
    }
  }

  let after: string | null = null;
  for (let index = targetIndex; index < orderedColumn.length; index += 1) {
    const key = orderedColumn[index]?.boardOrderKey;
    if (key) {
      after = key;
      break;
    }
  }

  return keyBetween(before, after);
}
