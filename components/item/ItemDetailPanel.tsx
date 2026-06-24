"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { ItemPresence } from "@/components/item/ItemPresence";
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
import { isPresenceEnabled } from "@/lib/realtime/presence-gate";
import { usePresenceRooms } from "@/lib/realtime/use-presence-rooms";
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
  const fallbackMembers = useMemo(
    () =>
      item.assigneeId
        ? [{ userId: item.assigneeId, label: item.assigneeId }]
        : [],
    [item.assigneeId],
  );
  const members = useMemo(
    () => membersQuery.data?.members ?? fallbackMembers,
    [fallbackMembers, membersQuery.data?.members],
  );
  const selfUserId = membersQuery.data?.currentUserId ?? currentUserId;
  const presenceEnabled = isPresenceEnabled();
  const presence = usePresenceRooms({
    enabled: presenceEnabled && open,
    roomIds: [listItem.listId],
    userId: selfUserId,
  });
  const setPresenceTyping = presence.setTyping;
  const memberLabels = useMemo(
    () => new Map(members.map((member) => [member.userId, member.label])),
    [members],
  );
  const labelForUser = useCallback(
    (userId: string) => memberLabels.get(userId),
    [memberLabels],
  );
  const handleTypingChange = useCallback(
    (typing: boolean) => {
      if (!presenceEnabled || !open) return;
      setPresenceTyping(typing);
    },
    [open, presenceEnabled, setPresenceTyping],
  );

  useEffect(() => {
    if (!open) setPresenceTyping(false);

    return () => {
      setPresenceTyping(false);
    };
  }, [open, setPresenceTyping]);

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
          {presenceEnabled && (
            <ItemPresence
              currentUserId={selfUserId}
              roster={presence.roster}
              labelForUser={labelForUser}
            />
          )}

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
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label}
                  {member.userId === selfUserId ? " (you)" : ""}
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
                onTypingChange={handleTypingChange}
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
