"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, X } from "lucide-react";
import { memo, useEffect, useState } from "react";
import ListInlineEdit from "./ListInlineEdit";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ListItem } from "./types";
import { cn } from "@/lib/utils";
import { useRenderMeasure } from "@/lib/optimistic-debug";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { ItemNotesEditor } from "./ItemNotesEditor";
import { isYjsNotesEnabled } from "@/lib/collab/yjs-notes-gate";


interface ListItemComponentProps {
  listItem: ListItem;
  index: number;
  shouldRevealOnMount?: boolean;
  onRevealComplete?: () => void;
  userId: string | null;
  canEdit?: boolean;
}

const ListItemComponent = ({
  listItem,
  index,
  shouldRevealOnMount,
  onRevealComplete,
  userId,
  canEdit = true,
}: ListItemComponentProps) => {

  useRenderMeasure(`ListItemComponent:${listItem.id}`);

  const [itemDeleted, setItemDeleted] = useState<boolean>(false);
  const [itemRevealed, setItemRevealed] = useState(!shouldRevealOnMount);

  useEffect(() => {
    if (!shouldRevealOnMount) return;

    const timeout = setTimeout(() => {
      setItemRevealed(true);
      onRevealComplete?.();
    }, 0);

    return () => clearTimeout(timeout);
  }, [shouldRevealOnMount, onRevealComplete, listItem.id]);

  const dashboardMutations = useDashboardMutations();

  const handleRenameItem = (input: { id: string; name: string }) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.updateItem({
      id: input.id,
      name: input.name,
      now: new Date().toISOString(),
    });
  };

  const deleteItem = (itemId: string) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.deleteItem({ id: itemId });
  };

  const handleToggleCompletion = () => {
    const nextCompleted = !listItem.completed;

    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.updateItem({
      id: listItem.id,
      completed: nextCompleted,
      now: new Date().toISOString(),
    });
  };

  const { ref, handleRef: itemHandle, isDragging } = useSortable({
    id: `list-item-${listItem.id}`,
    index,
    type: 'list-item',
    accept: 'list-item',
    group: "list-items",
    disabled: !canEdit,
  });

  if (itemDeleted) {
    return null;
  }

  return (
    <div
      data-testid="list-item"
      ref={ref}
      className={cn(
        `flex items-start gap-1.5 pr-1.5 rounded-md border border-white hover:bg-gray-50 hover:border-gray-100 overflow-hidden transition-[max-height,opacity,transform,padding,scale,shadow] duration-200 ease-in-out group`,
        {
          "scale-[1.01] backdrop-blur-[5px] shadow-md bg-gray-50 border border-gray-100": isDragging,
          "max-h-200 opacity-100 scale-100": !itemDeleted && itemRevealed,
          "max-h-0 opacity-0 py-0": itemDeleted || !itemRevealed,
        }
      )}
    >
      <div
        data-testid="item-drag-handle"
        ref={canEdit ? itemHandle : undefined}
        className={cn(
          "touch-none select-none p-1.5 -mt-px -mr-1 shrink-0 text-gray-400",
          canEdit
            ? "cursor-grab active:cursor-grabbing"
            : "cursor-default opacity-30",
        )}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <Checkbox
        className="w-4 h-4 shrink-0 hover:cursor-pointer my-1"
        checked={listItem.completed}
        onClick={handleToggleCompletion}
        disabled={!canEdit}
      />

      <div className="min-w-0 flex-1">
        <ListInlineEdit
          displayTestId="list-item-title"
          inputTestId="list-title-input"
          className={cn(
            "block w-full min-w-0 text-sm whitespace-normal break-all break-normal transition-colors duration-300 leading-6!",
            listItem.completed && "line-through text-gray-500"
          )}
          id={listItem.id}
          value={listItem.name}
          onSave={handleRenameItem}
          disabled={!canEdit}
          displayClassName="whitespace-normal"
          inputClassName="text-sm! p-0! leading-6! break-normal!"
        />
        {isYjsNotesEnabled() && (
          <ItemNotesEditor
            itemId={listItem.id}
            canEdit={canEdit}
            initialNotes={listItem.notes ?? ""}
          />
        )}
      </div>

      {canEdit && <Button
        className="scale-80 shrink-0 self-start bg-transparent hover:bg-red-500/10 opacity-100 transition-all duration-100"
        variant="destructive"
        size="icon-xs"
        onClick={() => {
          if (!userId) return;

          setItemDeleted(true);
          deleteItem(listItem.id);
        }}
      >
        <X />
      </Button>}
    </div>
  );
};

export default memo(ListItemComponent);
