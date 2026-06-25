import { BOARD_COLUMNS, type BoardCardItem } from "@/lib/board/board-order";
import type { ItemStatus } from "@/lib/sync/replicache/keys";

export type BoardRollup = {
  counts: Record<ItemStatus, number>;
  total: number;
  completionPercent: number;
};

export function computeBoardRollup(
  groups: Record<ItemStatus, ReadonlyArray<BoardCardItem>>,
): BoardRollup {
  const counts = Object.fromEntries(
    BOARD_COLUMNS.map((column) => [
      column.status,
      groups[column.status].length,
    ]),
  ) as Record<ItemStatus, number>;

  const total = BOARD_COLUMNS.reduce(
    (sum, column) => sum + counts[column.status],
    0,
  );

  const completionPercent =
    total === 0 ? 0 : Math.round((counts.DONE / total) * 100);

  return { counts, total, completionPercent };
}
