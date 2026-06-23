"use client";

import { useQuery } from "@tanstack/react-query";

import { ItemNotesField } from "@/components/item/ItemNotesField";
import type { ListItem } from "@/components/list/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { isYjsNotesEnabled } from "@/lib/collab/yjs-notes-gate";
import { isItemPanelEnabled } from "@/lib/item-panel/item-panel-gate";
import type { ItemStatus } from "@/lib/sync/replicache/keys";
import { useTRPC } from "@/trpc/client";

const ITEM_STATUS_OPTIONS: Array<{ value: ItemStatus; label: string }> = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

type ItemWithProperties = ListItem & {
  status: ItemStatus;
  assigneeId: string | null;
};

export function ItemDetailPanel({
  open,
  onOpenChange,
  listItem,
  canEdit,
  currentUserId,
}: ItemDetailPanelProps) {
  if (!isItemPanelEnabled()) return null;

  return (
    <EnabledItemDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      listItem={listItem}
      canEdit={canEdit}
      currentUserId={currentUserId}
    />
  );
}

type ItemDetailPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listItem: ListItem;
  canEdit: boolean;
  currentUserId: string | null;
};

function EnabledItemDetailPanel({
  open,
  onOpenChange,
  listItem,
  canEdit,
  currentUserId,
}: ItemDetailPanelProps) {
  const item = listItem as ItemWithProperties;
  const dashboardMutations = useDashboardMutations();
  const trpc = useTRPC();
  const membersQuery = useQuery({
    ...trpc.listItem.getAssignableMembers.queryOptions({
      listId: listItem.listId,
    }),
    enabled: open && canEdit,
  });
  const memberIds = membersQuery.data?.members ??
    (item.assigneeId ? [item.assigneeId] : []);
  const selfUserId = membersQuery.data?.currentUserId ?? currentUserId;

  function handleStatusChange(status: ItemStatus) {
    if (!canEdit || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.updateItem({
      id: listItem.id,
      status,
      now: new Date().toISOString(),
    });
  }

  function handleAssigneeChange(assigneeId: string | null) {
    if (!canEdit || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.updateItem({
      id: listItem.id,
      assigneeId,
      now: new Date().toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="item-detail-panel" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{listItem.name}</DialogTitle>
          <DialogDescription>
            {listItem.completed ? "Completed" : "Not completed"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label
              htmlFor={`item-status-${listItem.id}`}
              className="text-sm font-medium"
            >
              Status
            </label>
            <select
              id={`item-status-${listItem.id}`}
              value={item.status}
              disabled={!canEdit}
              onChange={(event) =>
                handleStatusChange(event.target.value as ItemStatus)
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ITEM_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label
              htmlFor={`item-assignee-${listItem.id}`}
              className="text-sm font-medium"
            >
              Assignee
            </label>
            <select
              id={`item-assignee-${listItem.id}`}
              value={item.assigneeId ?? ""}
              disabled={!canEdit}
              onChange={(event) =>
                handleAssigneeChange(event.target.value || null)
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {memberIds.map((memberId) => (
                <option key={memberId} value={memberId}>
                  {memberId}
                  {memberId === selfUserId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
