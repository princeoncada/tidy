"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BoardCardItem } from "@/lib/board/board-order";

const STATUS_LABELS: Record<BoardCardItem["status"], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

type BoardCardProps = {
  item: BoardCardItem;
  index: number;
  parentListName: string;
  canEdit: boolean;
};

export function BoardCard({
  item,
  index,
  parentListName,
  canEdit,
}: BoardCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: `board-card-${item.id}`,
    index,
    type: "board-card",
    accept: "board-card",
    group: "board-cards",
    disabled: !canEdit,
  });

  return (
    <article
      ref={ref}
      data-testid="board-card"
      data-item-id={item.id}
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm transition-[border,box-shadow,transform] duration-150",
        "focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30",
        isDragging && "scale-[1.01] border-border-strong shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          ref={canEdit ? handleRef : undefined}
          type="button"
          aria-label={`Move ${item.name}`}
          disabled={!canEdit}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-focus",
            canEdit
              ? "cursor-grab hover:bg-surface-muted active:cursor-grabbing"
              : "cursor-default opacity-40",
          )}
        >
          <GripVertical className="size-3.5" />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="break-words text-sm font-medium leading-5 text-text">
            {item.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <span className="max-w-full truncate">{parentListName}</span>
            <span aria-hidden="true">/</span>
            <span>{STATUS_LABELS[item.status]}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
