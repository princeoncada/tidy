"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, X } from "lucide-react";
import { memo, useEffect, useState } from "react";
import ListInlineEdit from "./ListInlineEdit";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ListItem } from "./types";
import { cn } from "@/lib/utils";
import { DashboardKeys, updateListInDashboardCaches } from "@/lib/dashboard-cache";
import { useRenderMeasure } from "@/lib/optimistic-debug";
import {
  commitLocalListItemCompletion,
  commitLocalListItemDelete,
  commitLocalListItemRename,
} from "@/lib/local-db/local-write";


interface ListItemComponentProps {
  listItem: ListItem;
  index: number;
  shouldRevealOnMount?: boolean;
  onRevealComplete?: () => void;
  dashboardKeys: DashboardKeys;
  userId: string | null;
}

const ListItemComponent = ({
  listItem,
  index,
  shouldRevealOnMount,
  onRevealComplete,
  dashboardKeys,
  userId
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

  const queryClient = useQueryClient();

  const handleRenameItem = (input: { id: string; name: string }) => {
    if (!userId) return;

    updateListInDashboardCaches(queryClient, dashboardKeys, listItem.listId, (list) => ({
      ...list,
      listItems: list.listItems.map((item: ListItem) =>
        item.id === input.id ? { ...item, name: input.name } : item
      ),
    }));
    void commitLocalListItemRename({
      userId,
      itemId: input.id,
      name: input.name,
    }).catch(() => {});
  };

  const deleteItem = (itemId: string) => {
    if (!userId) return;

    updateListInDashboardCaches(queryClient, dashboardKeys, listItem.listId, (list) => ({
      ...list,
      listItems: list.listItems.filter((item: ListItem) => item.id !== itemId),
    }));
    void commitLocalListItemDelete({ userId, itemId }).catch(() => {});
  };

  const handleToggleCompletion = () => {
    const nextCompleted = !listItem.completed;

    if (!userId) return;

    updateListInDashboardCaches(queryClient, dashboardKeys, listItem.listId, (list) => ({
      ...list,
      listItems: list.listItems.map((item: ListItem) =>
        item.id === listItem.id
          ? { ...item, completed: nextCompleted }
          : item
      ),
    }));
    void commitLocalListItemCompletion({
      userId,
      itemId: listItem.id,
      completed: nextCompleted,
    }).catch(() => {});
  };

  const { ref, handleRef: itemHandle, isDragging } = useSortable({
    id: `list-item-${listItem.id}`,
    index,
    type: 'list-item',
    accept: 'list-item',
    group: "list-items"
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
        ref={itemHandle}
        className="cursor-grab active:cursor-grabbing touch-none select-none p-1.5 -mt-px -mr-1 shrink-0 text-gray-400"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <Checkbox
        className="w-4 h-4 shrink-0 hover:cursor-pointer my-1"
        checked={listItem.completed}
        onClick={handleToggleCompletion}
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
          displayClassName="whitespace-normal"
          inputClassName="text-sm! p-0! leading-6! break-normal!"
        />
      </div>

      <Button
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
      </Button>
    </div>
  );
};

export default memo(ListItemComponent);
