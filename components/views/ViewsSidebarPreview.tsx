"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  GripVertical,
  Layers,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptimisticSync } from "@/hooks/useOptimisticSync";
import {
  applyViewFilterUpdateToCaches,
  applyViewRenameToViewsCache,
  applyViewSelection,
  buildDashboardKeys,
  captureViewMutationSnapshots,
  commitViewOrderToViewsCache,
  DashboardSnapshot,
  insertOptimisticViewIntoDashboardCaches,
  listMatchesView,
  removeViewFromDashboardCaches,
  ViewsCache,
} from "@/lib/dashboard-cache";
import {
  measureCacheWrite,
  measureOptimisticEvent,
  OptimisticProfiler,
  useRenderMeasure,
} from "@/lib/optimistic-debug";
import {
  commitLocalSelectedView,
  commitLocalViewCreate,
  commitLocalViewDelete,
  commitLocalViewReorder,
  commitLocalViewUpdate,
} from "@/lib/local-db/local-write";
import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type ViewItem = RouterOutputs["view"]["getAll"][number];
type TagItem = RouterOutputs["tag"]["getAll"][number];

type ViewDialogMode = "create" | "edit";

type ViewDialogState = {
  mode: ViewDialogMode;
  view?: ViewItem;
};

function buildOptimisticView({
  id,
  name,
  tagIds,
  views,
  tags,
  allListsSnapshot,
}: {
  id: string;
  name: string;
  tagIds: string[];
  views: ViewsCache | undefined;
  tags: TagItem[];
  allListsSnapshot: DashboardSnapshot | undefined;
}): ViewItem {
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
  const optimisticView: ViewItem = {
    id,
    name,
    userId: "optimistic",
    order: views?.length ? Math.min(...views.map((view) => view.order)) - 1 : 0,
    type: "CUSTOM",
    isDefault: true,
    matchMode: "ALL",
    createdAt: new Date(),
    updatedAt: new Date(),
    viewTags: selectedTags.map((tag) => ({
      viewId: id,
      tagId: tag.id,
      tag,
    })),
    viewLists: [],
  };

  optimisticView.viewLists = (allListsSnapshot?.lists ?? [])
    .filter((list) => listMatchesView(list, optimisticView))
    .map((list) => ({ listId: list.id, order: list.order }));

  return optimisticView;
}

function moveCustomView(
  views: ViewItem[],
  sourceId: string,
  targetId: string
) {
  const sourceIndex = views.findIndex((view) => view.id === sourceId);
  const targetIndex = views.findIndex((view) => view.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return null;
  }

  const nextViews = [...views];
  const [moved] = nextViews.splice(sourceIndex, 1);
  nextViews.splice(targetIndex, 0, moved);

  return nextViews.map((view, index) => ({
    ...view,
    order: index,
  }));
}

type SortableViewRowProps = {
  view: ViewItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (view: ViewItem) => void;
  onDelete: (id: string) => void;
};

function SortableViewRowComponent({
  view,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: SortableViewRowProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: view.id,
    index,
    type: "view",
    group: "views",
    accept: "view",
  });

  return (
    <div
      data-testid="view-card"
      ref={ref}
      className={cn(
        "group/view-row flex items-center gap-0.5 rounded-md border border-transparent pr-0.5 transition",
        "hover:border-zinc-200 hover:bg-zinc-50",
        isDragging && "scale-[1.01] border-zinc-300 bg-zinc-100 shadow-sm"
      )}
    >
      <button
        ref={handleRef}
        type="button"
        className={cn(
          "cursor-grab rounded-sm p-1 text-zinc-400 transition",
          "hover:bg-zinc-200/70 hover:text-zinc-700 active:cursor-grabbing"
        )}
        aria-label={`Reorder ${view.name}`}
        data-testid="view-drag-handle"
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onSelect(view.id)}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between rounded-sm px-1.5 py-1 text-left text-xs transition",
          isSelected ? "text-zinc-900" : "text-zinc-700 hover:text-zinc-900"
        )}
      >
        <span className="truncate">{view.name}</span>
        <Check
          className={cn(
            "size-3.5 shrink-0",
            isSelected ? "opacity-100 text-zinc-700" : "opacity-0"
          )}
        />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 opacity-0 transition group-hover/view-row:opacity-100 aria-expanded:opacity-100"
          >
            <MoreHorizontal className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => onEdit(view)} className="text-xs">
            <Pencil className="size-3" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(view.id)}
            className="text-xs"
          >
            <Trash2 className="size-3" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const SortableViewRow = memo(SortableViewRowComponent);

function ViewsSidebarSkeleton() {
  return (
    <Card className="w-full border-zinc-200/80 bg-white/90 shadow-none py-0 mt-3">
      <CardHeader className="px-3 py-3">
        <CardTitle className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-4 w-12" />
          </span>
          <Skeleton className="h-6 w-20" />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        <div className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-2 py-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3.5 w-16" />
          </span>
          <Skeleton className="size-3.5" />
        </div>

        <Separator />

        <div className="space-y-0.5">
          {[72, 92, 64].map((width) => (
            <div
              key={width}
              className="flex items-center gap-1 rounded-md border border-transparent pr-0.5"
            >
              <Skeleton className="size-5" />
              <div className="flex min-w-0 flex-1 items-center justify-between px-1.5 py-1">
                <Skeleton className="h-3.5" style={{ width }} />
                <Skeleton className="size-3.5" />
              </div>
              <Skeleton className="size-5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type ViewDialogProps = {
  state: ViewDialogState;
  tags: TagItem[];
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, tagIds: string[]) => void;
  onUpdate: (view: ViewItem, name: string, tagIds: string[]) => void;
};

function ViewDialog({
  state,
  tags,
  onOpenChange,
  onCreate,
  onUpdate,
}: ViewDialogProps) {
  const view = state?.view;
  const [name, setName] = useState(state.view?.name ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    state.view?.viewTags.map((viewTag) => viewTag.tagId) ?? []
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((currentTagId) => currentTagId !== tagId)
        : [...current, tagId]
    );
  };

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || selectedTagIds.length === 0) return;

    if (state.mode === "edit" && view) {
      onUpdate(view, trimmedName, selectedTagIds);
      return;
    }

    onCreate(trimmedName, selectedTagIds);
  };

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "edit" ? "Edit View" : "Create View"}
          </DialogTitle>
          <DialogDescription>
            Choose the tags this view should require.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit();
                }
              }}
              placeholder="Work sprint"
            />
          </div>

          <div className="space-y-2">
            <Label>Required tags</Label>
            <ScrollArea className="h-44 rounded-md border">
              <div className="space-y-1 p-2">
                {tags.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    Create tags on your lists first.
                  </p>
                )}
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);

                  return (
                    <div
                      key={tag.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleTag(tag.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTag(tag.id);
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-zinc-50"
                    >
                      <Checkbox checked={selected} />
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {tag.color}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button data-testid="save-view-button" type="button" disabled={!name.trim() || selectedTagIds.length === 0} onClick={submit}>
            {state?.mode === "edit" ? "Save View" : "Create View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ViewsSidebarPreview({
  userId,
}: {
  userId: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const optimisticSync = useOptimisticSync();
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragPreviewViewsRef = useRef<ViewItem[] | null>(null);

  const [dialogState, setDialogState] = useState<ViewDialogState | null>(null);
  const [dragPreviewViews, setDragPreviewViews] = useState<ViewItem[] | null>(null);

  useRenderMeasure("ViewsSidebarPreview");

  const { data: views = [], isLoading: viewsLoading } = useQuery(trpc.view.getAll.queryOptions());
  const { data: tags = [], isLoading: tagsLoading } = useQuery(trpc.tag.getAll.queryOptions());

  const allListsView = useMemo(
    () => views.find((view) => view.type === "ALL_LISTS"),
    [views]
  );
  const { isLoading: allListsLoading } = useQuery(
    trpc.view.getViewListsWithItems.queryOptions(
      { viewId: allListsView?.id ?? "00000000-0000-0000-0000-000000000000" },
      { enabled: Boolean(allListsView?.id) }
    )
  );
  const savedCustomViews = useMemo(
    () => views.filter((view) => view.type === "CUSTOM"),
    [views]
  );
  const customViews = dragPreviewViews ?? savedCustomViews;
  const selectedViewId = useMemo(
    () => views.find((view) => view.isDefault)?.id ?? allListsView?.id,
    [allListsView?.id, views]
  );
  const dashboardKeys = buildDashboardKeys(trpc, {
    allListsViewId: allListsView?.id,
    selectedViewId,
  });
  const queryKey = dashboardKeys.allLists;

  const setLocalViewPreview = useCallback((nextViews: ViewItem[] | null) => {
    dragPreviewViewsRef.current = nextViews;
    setDragPreviewViews(nextViews);
  }, [setDragPreviewViews]);

  const scheduleReorderSave = useCallback((nextViews: ViewItem[]) => {
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }

    reorderTimeoutRef.current = setTimeout(() => {
      if (!userId || nextViews.length === 0) return;

      optimisticSync.replacePending("views", async () => {
        try {
          await commitLocalViewReorder({
            userId,
            orderedViewIds: nextViews.map((view) => view.id),
          });
        } catch {
          // Local persistence must not replace the committed cache order.
        }
      }, { label: "view.reorderViews" });
    }, 300);
  }, [optimisticSync, userId]);

  const commitViewOrder = useCallback((nextViews: ViewItem[]) => {
    if (!userId) return;

    // Only save the final dropped order. Older drag positions do not matter.
    measureCacheWrite("views.drop.order", nextViews);
    commitViewOrderToViewsCache(queryClient, dashboardKeys, nextViews);
    scheduleReorderSave(nextViews);
  }, [queryClient, scheduleReorderSave, dashboardKeys, userId]);

  const moveViewPreview = useCallback((sourceId: string, targetId: string) => {
    const baseViews = dragPreviewViewsRef.current ?? customViews;
    const nextViews = moveCustomView(baseViews, sourceId, targetId);

    if (nextViews) setLocalViewPreview(nextViews);
  }, [customViews, setLocalViewPreview]);

  function selectView(id: string | undefined) {
    if (!id || selectedViewId === id || !userId) return;

    applyViewSelection(queryClient, dashboardKeys, id);
    optimisticSync.replacePending(
      "view-selection",
      async () => {
        try {
          await commitLocalSelectedView({ userId, viewId: id });
        } catch {
          // Local persistence must not replace the committed cache selection.
        }
      },
      { label: "view.saveSelectedView" }
    );
  }

  function createView(name: string, tagIds: string[]) {
    if (tagIds.length === 0 || !userId) return;

    const viewId = crypto.randomUUID();
    const snapshots = captureViewMutationSnapshots(queryClient, dashboardKeys);
    const allListsSnapshot = queryClient.getQueryData<DashboardSnapshot>(queryKey);
    const optimisticView = buildOptimisticView({
      id: viewId,
      name,
      tagIds,
      views: snapshots.previousViews,
      tags,
      allListsSnapshot,
    });

    insertOptimisticViewIntoDashboardCaches(
      queryClient,
      dashboardKeys,
      optimisticView,
      allListsSnapshot
    );
    void commitLocalViewCreate({
      userId,
      viewId,
      name,
      tagIds,
    }).catch(() => {});
    setDialogState(null);
  }

  function updateView(view: ViewItem, name: string, tagIds: string[]) {
    if (tagIds.length === 0 || !userId) return;

    const currentTagIds = view.viewTags.map((viewTag) => viewTag.tagId).sort();
    const nextTagIds = [...tagIds].sort();
    const nameChanged = view.name !== name;
    const tagsChanged = currentTagIds.join("|") !== nextTagIds.join("|");

    if (nameChanged) {
      applyViewRenameToViewsCache(queryClient, dashboardKeys, view.id, name);
    }

    if (tagsChanged) {
      const allListsSnapshot =
        queryClient.getQueryData<DashboardSnapshot>(queryKey);
      const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));

      applyViewFilterUpdateToCaches(queryClient, dashboardKeys, {
        viewId: view.id,
        selectedTags,
        allListsSnapshot,
      });
    }

    if (nameChanged || tagsChanged) {
      void commitLocalViewUpdate({
        userId,
        viewId: view.id,
        ...(nameChanged ? { name } : {}),
        ...(tagsChanged ? { tagIds } : {}),
      }).catch(() => {});
    }

    setDialogState(null);
  }

  function deleteView(id: string) {
    if (!userId) return;

    const allListsSnapshot = queryClient.getQueryData<DashboardSnapshot>(queryKey);

    removeViewFromDashboardCaches(
      queryClient,
      dashboardKeys,
      id,
      allListsSnapshot
    );
    void commitLocalViewDelete({ userId, viewId: id }).catch(() => {});
  }

  function openCreateView() {
    setDialogState({ mode: "create" });
  }

  function openEditView(view: ViewItem) {
    setDialogState({ mode: "edit", view });
  }

  function closeDialog(open: boolean) {
    if (!open) setDialogState(null);
  }

  if (viewsLoading || tagsLoading || !allListsView || allListsLoading) {
    return <ViewsSidebarSkeleton />;
  }

  return (
    <>
      <Card className="w-full border-zinc-200/80 bg-white/90 shadow-none py-0 mt-3">
        <CardHeader className="px-3 py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ListFilter className="size-3.5 text-zinc-500" />
              Views
            </span>
            <Button
              data-testid="view-create-button"
              type="button"
              size="xs"
              variant="outline"
              className="h-6 px-2"
              onClick={openCreateView}
            >
              <Plus className="size-3" />
              Add View
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 px-3 pb-3 pt-0">
          <button
            type="button"
            onClick={() => selectView(allListsView?.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-md border hover:bg-zinc-50 px-2 py-1.5 text-left text-xs transition",
              selectedViewId === allListsView?.id
                ? "border-zinc-300 text-zinc-900"
                : "border-zinc-200 text-zinc-700"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              All Lists
            </span>
            <Check
              className={cn(
                "size-3.5",
                selectedViewId === allListsView?.id
                  ? "opacity-100 text-zinc-700"
                  : "opacity-0"
              )}
            />
          </button>

          {customViews.length > 0 && <Separator />}

          <DragDropProvider
            onDragStart={() => {
              // Keep view drag order local so hovering does not rewrite the views cache.
              measureOptimisticEvent("views.drag.start", { count: customViews.length });
              setLocalViewPreview(customViews);
            }}
            onDragEnd={(event) => {
              const finalPreview = dragPreviewViewsRef.current;
              setLocalViewPreview(null);

              if (event.canceled) {
                // Cancelled drags should leave cache and server data untouched.
                measureOptimisticEvent("views.drag.cancel");
                return;
              }

              if (!event.operation.source || !finalPreview) return;

              measureOptimisticEvent("views.drag.end", {
                count: finalPreview.length,
              });
              commitViewOrder(finalPreview);
            }}
            onDragOver={(event) => {
              const { source, target } = event.operation;

              if (!source || !target) return;
              if (source.type !== "view" || target.type !== "view") return;

              const sourceId = String(source.id);
              const targetId = String(target.id);

              if (sourceId === targetId) return;

              measureOptimisticEvent("views.drag.over", {
                sourceId,
                targetId,
              });
              moveViewPreview(sourceId, targetId);
            }}
          >
            <OptimisticProfiler id="views-sidebar-rows">
              <div className="space-y-0.5">
                {customViews.map((view, index) => (
                  <SortableViewRow
                    key={view.id}
                    view={view}
                    index={index}
                    isSelected={selectedViewId === view.id}
                    onSelect={selectView}
                    onEdit={openEditView}
                    onDelete={deleteView}
                  />
                ))}
              </div>
            </OptimisticProfiler>
          </DragDropProvider>
        </CardContent>
      </Card>

      {dialogState && (
        <ViewDialog
          key={dialogState.view?.id ?? "create"}
          state={dialogState}
          tags={tags}
          onOpenChange={closeDialog}
          onCreate={createView}
          onUpdate={updateView}
        />
      )}
    </>
  );
}
