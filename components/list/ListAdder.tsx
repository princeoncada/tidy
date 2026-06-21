"use client";

import type { LocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useReplicacheDashboard } from "@/hooks/useReplicacheDashboard";
import { keyBetween } from "@/lib/sync/fractional-index";
import { replicacheKeys } from "@/lib/sync/replicache/keys";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";

type ListAdderProps = {
  boot: LocalFirstDashboardBoot;
};

const ListAdder = ({ boot }: ListAdderProps) => {

  const [createListName, setCreateListName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const replicacheDashboard = useReplicacheDashboard();
  const dashboardMutations = useDashboardMutations();
  const allListsView = replicacheDashboard.views.find((view) => view.type === "ALL_LISTS");

  const handleCreateList = () => {
    const name = createListName.trim();
    const userId = boot.userId;

    if (!name || !userId || !dashboardMutations.mutate || !allListsView) return;

    const newListId = crypto.randomUUID();
    const activeView = replicacheDashboard.selectedView;
    const inheritedListTags = activeView?.type === "CUSTOM"
      ? activeView.viewTags.map((viewTag) => ({
          listId: newListId,
          tagId: viewTag.tagId,
          tag: viewTag.tag,
        }))
      : [];
    const firstListId = replicacheDashboard.allLists?.lists[0]?.id;
    const firstOrderKey = firstListId
      ? replicacheDashboard.orderKeys.viewLists.get(
          replicacheKeys.viewList(allListsView.id, firstListId),
        ) ?? null
      : null;

    void dashboardMutations.mutate.createList({
      id: newListId,
      userId,
      name,
      allListsViewId: allListsView.id,
      order: keyBetween(null, firstOrderKey),
      inheritedTagIds: inheritedListTags.map((listTag) => listTag.tagId),
      now: new Date().toISOString(),
    });
    setCreateListName("");
  };

  if (!replicacheDashboard.ready || !allListsView) {
    return (
      <Skeleton className="h-9 w-full" />
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setCreateListName("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          data-testid="create-list-button"
          className="w-full justify-start px-2 font-semibold focus-visible:ring-2 focus-visible:ring-focus"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          Add List
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
          <DialogDescription>
            Give your new todo list a name
          </DialogDescription>
        </DialogHeader>
        <Separator className="-ml-10 w-[120%]!" />
        <div className="flex items-center gap-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              className="rounded-lg"
              type="text"
              placeholder="Enter your list name..."
              value={createListName}
              onChange={(e) => { setCreateListName(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateList();
                  setDialogOpen(false);
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" size="lg" variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            size="lg"
            onClick={() => {
              handleCreateList();
              setDialogOpen(false);
            }}
            disabled={createListName.trim().length === 0 || !boot.userId}
          >Create List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ListAdder;
