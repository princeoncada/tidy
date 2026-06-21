"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Check,
  ChevronDown,
  GripVertical,
  Layers,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useReplicacheDashboard } from "@/hooks/useReplicacheDashboard";
import { sameViewOrder } from "@/lib/dashboard/views-reorder";
import { measureOptimisticEvent, OptimisticProfiler, useRenderMeasure } from "@/lib/optimistic-debug";
import { keyBetween } from "@/lib/sync/fractional-index";
import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ViewItem = RouterOutputs["view"]["getAll"][number];
type TagItem = RouterOutputs["tag"]["getAll"][number];

type ViewDialogMode = "create" | "edit";

type ViewDialogState = {
  mode: ViewDialogMode;
  view?: ViewItem;
};

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
        "hover:border-border hover:bg-surface-muted",
        isDragging && "scale-[1.01] border-border bg-surface-muted shadow-sm"
      )}
    >
      <button
        ref={handleRef}
        type="button"
        className={cn(
          "cursor-grab rounded-sm p-1 text-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          "hover:bg-surface-muted/70 hover:text-text-muted active:cursor-grabbing"
        )}
        aria-label={`Reorder ${view.name}`}
        data-testid="view-drag-handle"
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        aria-current={isSelected ? "page" : undefined}
        onClick={() => onSelect(view.id)}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between rounded-sm px-1.5 py-1 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          isSelected ? "text-text" : "text-text-muted hover:text-text"
        )}
      >
        <span className="truncate">{view.name}</span>
        <Check
          className={cn(
            "size-3.5 shrink-0",
            isSelected ? "opacity-100 text-text-muted" : "opacity-0"
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
    <div className="flex h-9 items-center gap-2 px-2">
      <Skeleton className="size-4" />
      <Skeleton className="h-4 w-12" />
    </div>
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
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-surface-muted"
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
  const replicacheDashboard = useReplicacheDashboard();
  const dashboardMutations = useDashboardMutations();
  const dragPreviewViewsRef = useRef<ViewItem[] | null>(null);
  const awaitingCommitRef = useRef(false);
  const relinquishFallbackRef = useRef<NodeJS.Timeout | null>(null);
  const draggingRef = useRef(false);

  const [dialogState, setDialogState] = useState<ViewDialogState | null>(null);
  const [dragPreviewViews, setDragPreviewViews] = useState<ViewItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useRenderMeasure("ViewsSidebarPreview");

  const views = replicacheDashboard.views;
  const tags = replicacheDashboard.tags;
  const allListsView = useMemo(
    () => views.find((view) => view.type === "ALL_LISTS"),
    [views]
  );
  const savedCustomViews = useMemo(
    () => views.filter((view) => view.type === "CUSTOM"),
    [views]
  );
  const customViews = dragPreviewViews ?? savedCustomViews;
  const selectedViewId = replicacheDashboard.selectedView?.id ?? allListsView?.id;

  const setLocalViewPreview = useCallback((nextViews: ViewItem[] | null) => {
    dragPreviewViewsRef.current = nextViews;
    setDragPreviewViews(nextViews);
  }, [setDragPreviewViews]);

  const commitReorderNow = useCallback((
    nextViews: ViewItem[],
    movedViewId: string,
  ) => {
    if (!userId || nextViews.length === 0 || !dashboardMutations.mutate) return;

    const movedIndex = nextViews.findIndex(
      (view) => view.id === movedViewId,
    );
    const beforeId = movedIndex > 0
      ? nextViews[movedIndex - 1]?.id
      : allListsView?.id;
    const afterId = movedIndex >= 0 && movedIndex < nextViews.length - 1
      ? nextViews[movedIndex + 1]?.id
      : undefined;
    void dashboardMutations.mutate.reorderViews({
      id: movedViewId,
      orderKey: keyBetween(
        beforeId
          ? replicacheDashboard.orderKeys.views.get(beforeId) ?? null
          : null,
        afterId
          ? replicacheDashboard.orderKeys.views.get(afterId) ?? null
          : null,
      ),
    });
  }, [
    allListsView?.id,
    dashboardMutations.mutate,
    replicacheDashboard.orderKeys.views,
    userId,
  ]);

  const commitViewOrder = useCallback((
    nextViews: ViewItem[],
    movedViewId: string,
  ) => {
    if (!userId) return;
    commitReorderNow(nextViews, movedViewId);
  }, [commitReorderNow, userId]);

  const scheduleRelinquishFallback = useCallback(() => {
    if (relinquishFallbackRef.current) {
      clearTimeout(relinquishFallbackRef.current);
    }
    relinquishFallbackRef.current = setTimeout(() => {
      relinquishFallbackRef.current = null;
      awaitingCommitRef.current = false;
      setLocalViewPreview(null);
    }, 1500);
  }, [setLocalViewPreview]);

  useEffect(() => {
    if (!awaitingCommitRef.current) return;

    const preview = dragPreviewViewsRef.current;
    if (!preview || !sameViewOrder(savedCustomViews, preview)) return;

    awaitingCommitRef.current = false;
    if (relinquishFallbackRef.current) {
      clearTimeout(relinquishFallbackRef.current);
      relinquishFallbackRef.current = null;
    }
    setLocalViewPreview(null);
  }, [savedCustomViews, setLocalViewPreview]);

  useEffect(() => () => {
    if (relinquishFallbackRef.current) {
      clearTimeout(relinquishFallbackRef.current);
    }
  }, []);

  const moveViewPreview = useCallback((sourceId: string, targetId: string) => {
    const baseViews = dragPreviewViewsRef.current ?? customViews;
    const nextViews = moveCustomView(baseViews, sourceId, targetId);

    if (nextViews) setLocalViewPreview(nextViews);
  }, [customViews, setLocalViewPreview]);

  function selectView(id: string | undefined) {
    if (!id || selectedViewId === id || !userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.setSelectedView({ viewId: id });
  }

  function createView(name: string, tagIds: string[]) {
    if (tagIds.length === 0 || !userId || !dashboardMutations.mutate) return;

    const viewId = crypto.randomUUID();
    const firstCustomViewId = savedCustomViews[0]?.id;
    const allListsOrderKey = allListsView
      ? replicacheDashboard.orderKeys.views.get(allListsView.id) ?? null
      : null;
    const firstCustomOrderKey = firstCustomViewId
      ? replicacheDashboard.orderKeys.views.get(firstCustomViewId) ?? null
      : null;

    void dashboardMutations.mutate.createView({
      id: viewId,
      userId,
      name,
      order: firstCustomOrderKey
        ? keyBetween(allListsOrderKey, firstCustomOrderKey)
        : keyBetween(allListsOrderKey, null),
      tagIds,
      matchMode: "ALL",
      now: new Date().toISOString(),
    });
    setDialogState(null);
  }

  function updateView(view: ViewItem, name: string, tagIds: string[]) {
    if (tagIds.length === 0 || !userId || !dashboardMutations.mutate) return;

    const currentTagIds = view.viewTags.map((viewTag) => viewTag.tagId).sort();
    const nextTagIds = [...tagIds].sort();
    const nameChanged = view.name !== name;
    const tagsChanged = currentTagIds.join("|") !== nextTagIds.join("|");

    if (nameChanged || tagsChanged) {
      void dashboardMutations.mutate.updateView({
        id: view.id,
        ...(nameChanged ? { name } : {}),
        ...(tagsChanged ? { tagIds } : {}),
        now: new Date().toISOString(),
      });
    }

    setDialogState(null);
  }

  function deleteView(id: string) {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.deleteView({
      id,
      fallbackViewId: allListsView?.id,
    });
  }

  function openCreateView() {
    setOpen(false);
    setDialogState({ mode: "create" });
  }

  function openEditView(view: ViewItem) {
    setDialogState({ mode: "edit", view });
  }

  function closeDialog(open: boolean) {
    if (!open) setDialogState(null);
  }

  if (!replicacheDashboard.ready || !allListsView) {
    return <ViewsSidebarSkeleton />;
  }

  return (
    <>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && draggingRef.current) return;
          setOpen(nextOpen);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between px-2 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="inline-flex items-center gap-1.5">
              <ListFilter className="size-4" />
              Views
            </span>
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60 p-2"
          onCloseAutoFocus={(event) => {
            if (draggingRef.current) event.preventDefault();
          }}
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-text-muted">Views</span>
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
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          <button
            type="button"
            aria-current={selectedViewId === allListsView?.id ? "page" : undefined}
            onClick={() => {
              selectView(allListsView?.id);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition hover:border-border hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              selectedViewId === allListsView?.id
                ? "border-border bg-selection text-text"
                : "text-text-muted hover:text-text"
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
                  ? "opacity-100 text-text-muted"
                  : "opacity-0"
              )}
            />
          </button>

          {customViews.length > 0 && <Separator />}

          <DragDropProvider
            onDragStart={() => {
              draggingRef.current = true;
              measureOptimisticEvent("views.drag.start", { count: customViews.length });
              awaitingCommitRef.current = false;
              if (relinquishFallbackRef.current) {
                clearTimeout(relinquishFallbackRef.current);
                relinquishFallbackRef.current = null;
              }
              setLocalViewPreview(customViews);
            }}
            onDragEnd={(event) => {
              draggingRef.current = false;
              const finalPreview = dragPreviewViewsRef.current;

              if (event.canceled) {
                awaitingCommitRef.current = false;
                setLocalViewPreview(null);
                measureOptimisticEvent("views.drag.cancel");
                return;
              }

              if (!event.operation.source || !finalPreview) {
                awaitingCommitRef.current = false;
                setLocalViewPreview(null);
                return;
              }

              measureOptimisticEvent("views.drag.end", {
                count: finalPreview.length,
              });
              awaitingCommitRef.current = true;
              scheduleRelinquishFallback();
              commitViewOrder(
                finalPreview,
                String(event.operation.source.id),
              );
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
                    onSelect={(id) => {
                      selectView(id);
                      setOpen(false);
                    }}
                    onEdit={openEditView}
                    onDelete={deleteView}
                  />
                ))}
              </div>
            </OptimisticProfiler>
          </DragDropProvider>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
