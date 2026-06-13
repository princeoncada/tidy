"use client";

import { useTRPC } from "@/trpc/client";
import type { LocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CurrentView, OptimisticList } from "./types";
import { Plus } from "lucide-react";
import {
  buildDashboardKeys,
  insertOptimisticListIntoDashboardCaches,
  reconcileLocallyCommittedListInDashboardCaches,
  selectedViewFromCache,
} from "@/lib/dashboard-cache";
import { LOCAL_ALL_LISTS_VIEW_ID } from "@/lib/local-first-dashboard";
import { commitLocalListCreate } from "@/lib/local-db/local-write";
import { Skeleton } from "../ui/skeleton";


type ListAdderProps = {
  boot: LocalFirstDashboardBoot;
};

const EMPTY_VIEW_ID = "00000000-0000-0000-0000-000000000000";

const ListAdder = ({ boot }: ListAdderProps) => {

  const [createListName, setCreateListName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: views, isLoading: viewsLoading } = useQuery(trpc.view.getAll.queryOptions());
  const serverViews = views?.some((view) => view.id === LOCAL_ALL_LISTS_VIEW_ID)
    ? undefined
    : views;
  const effectiveViews = views ?? boot.localViews;
  const allListsView = effectiveViews?.find((view) => view.type === "ALL_LISTS");
  const serverAllListsView = serverViews?.find((view) => view.type === "ALL_LISTS");
  const selectedView = selectedViewFromCache(effectiveViews);
  const serverSelectedView = selectedViewFromCache(serverViews);
  const selectedViewId = selectedView?.id;
  const dashboardKeys = buildDashboardKeys(trpc, {
    allListsViewId: allListsView?.id,
    selectedViewId,
  });
  const { views: viewsQueryKey } = dashboardKeys;

  const { isLoading: bootListsLoading } = useQuery(
    trpc.view.getCurrentViewListsWithItems.queryOptions()
  );

  const { isLoading: allListsLoading } = useQuery(
    trpc.view.getViewListsWithItems.queryOptions(
      { viewId: serverAllListsView?.id ?? EMPTY_VIEW_ID },
      { enabled: Boolean(serverAllListsView?.id) }
    )
  );

  const { isLoading: selectedViewLoading } = useQuery(
    trpc.view.getViewListsWithItems.queryOptions(
      { viewId: serverSelectedView?.id ?? EMPTY_VIEW_ID },
      { enabled: Boolean(serverSelectedView?.id) }
    )
  );

  const handleCreateList = () => {
    const name = createListName.trim();
    const userId = boot.userId;

    if (!name || !userId) return;

    const newListId = crypto.randomUUID();
    const activeView = selectedViewFromCache(queryClient.getQueryData(viewsQueryKey));
    const previousAllLists = queryClient.getQueryData<CurrentView>(dashboardKeys.allLists);
    const previousCurrentView = queryClient.getQueryData<CurrentView>(dashboardKeys.currentView);
    const baseLists = previousCurrentView?.lists ?? previousAllLists?.lists ?? [];
    const optimisticList: OptimisticList = {
      id: newListId,
      userId: "optimistic",
      name,
      order: baseLists.length > 0
        ? Math.min(...baseLists.map((list) => list.order)) - 1
        : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      listTags: [],
      listItems: [],
      isOptimistic: true,
    };

    insertOptimisticListIntoDashboardCaches(
      queryClient,
      dashboardKeys,
      optimisticList,
      activeView,
    );
    void commitLocalListCreate({
      userId,
      listId: newListId,
      name,
    })
      .then(() => {
        reconcileLocallyCommittedListInDashboardCaches(
          queryClient,
          dashboardKeys,
          newListId,
          userId,
        );
      })
      .catch(() => {
        // Local-first commit is best-effort and must not block the UI.
      });
    setCreateListName('');
  };

  const handleExit = () => {
    setTimeout(() => {
      setCreateListName('');
    }, 200);
  };

  const serverStillLoading = viewsLoading || bootListsLoading || allListsLoading || selectedViewLoading;
  if (!effectiveViews || !allListsView || (!boot.localBootReady && serverStillLoading)) {
    return (
      <div className="h-full flex items-end">
        <Skeleton className="hidden h-8 w-24 md:block" />
        <Skeleton className="size-9 md:hidden" />
      </div>
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    >
      <DialogTrigger className="h-full" asChild>
        <div className="h-full flex items-end">
          <Button
            data-testid="create-list-button"
            className="font-semibold hidden md:flex"
            variant="outline"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus className="-ml-1" />Add List
          </Button>
          <Button
            data-testid="create-list-button"
            className="font-semibold md:hidden p-4"
            size="icon-lg"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent
        onCloseAutoFocus={handleExit}
      >
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
