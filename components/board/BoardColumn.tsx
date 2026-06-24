"use client";

import { useDroppable } from "@dnd-kit/react";

import { BoardCard } from "@/components/board/BoardCard";
import {
  type BoardCardItem,
  type BoardColumnDefinition,
} from "@/lib/board/board-order";
import { cn } from "@/lib/utils";

type BoardColumnProps = {
  column: BoardColumnDefinition;
  items: ReadonlyArray<BoardCardItem>;
  listNames: ReadonlyMap<string, string>;
  canEditItem: (item: BoardCardItem) => boolean;
  activeDropTarget: { type: string; id: string } | null;
};

export function BoardColumn({
  column,
  items,
  listNames,
  canEditItem,
  activeDropTarget,
}: BoardColumnProps) {
  const columnId = `board-column-${column.status}`;
  const { ref } = useDroppable({
    id: columnId,
    type: "board-column",
    accept: "board-card",
  });
  const isActiveTarget =
    activeDropTarget?.id === columnId ||
    items.some((item) => `board-card-${item.id}` === activeDropTarget?.id);

  return (
    <section
      ref={ref}
      aria-labelledby={`${columnId}-heading`}
      className={cn(
        "flex min-h-80 min-w-0 flex-col rounded-lg border border-border bg-surface p-3 transition-colors",
        isActiveTarget && "border-border-strong bg-surface-muted",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id={`${columnId}-heading`}
          className="text-sm font-semibold text-text"
        >
          {column.label}
        </h2>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-text-muted">
          {items.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {items.map((item, index) => (
          <BoardCard
            key={item.id}
            item={item}
            index={index}
            parentListName={listNames.get(item.listId) ?? "Unknown list"}
            canEdit={canEditItem(item)}
          />
        ))}
        {items.length === 0 && (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
            No items
          </div>
        )}
      </div>
    </section>
  );
}
