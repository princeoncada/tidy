"use client";

import { ItemNotesField } from "@/components/item/ItemNotesField";
import type { ListItem } from "@/components/list/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isYjsNotesEnabled } from "@/lib/collab/yjs-notes-gate";
import { isItemPanelEnabled } from "@/lib/item-panel/item-panel-gate";

export function ItemDetailPanel({
  open,
  onOpenChange,
  listItem,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listItem: ListItem;
  canEdit: boolean;
}) {
  if (!isItemPanelEnabled()) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="item-detail-panel" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{listItem.name}</DialogTitle>
          <DialogDescription>
            {listItem.completed ? "Completed" : "Not completed"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Notes</p>
          {isYjsNotesEnabled() ? (
            <ItemNotesField
              itemId={listItem.id}
              canEdit={canEdit}
              initialNotes={listItem.notes ?? ""}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Notes are unavailable.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
