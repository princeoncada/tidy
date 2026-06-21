"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, ChevronDown, GripVertical, Layers, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WorkspacesDialog } from "@/components/sharing/WorkspacesDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { movedRowOrderKey } from "@/lib/dashboard/views-reorder";
import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type Workspace = RouterOutputs["share"]["getOwnedWorkspaces"][number];

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string | null;
  onSelect: (id: string | null) => void;
};

function moveWorkspace(
  workspaces: Workspace[],
  sourceId: string,
  targetId: string,
) {
  const sourceIndex = workspaces.findIndex((workspace) => workspace.id === sourceId);
  const targetIndex = workspaces.findIndex((workspace) => workspace.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return null;

  const next = [...workspaces];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function sameWorkspaceOrder(left: Workspace[], right: Workspace[]) {
  return left.length === right.length &&
    left.every((workspace, index) => workspace.id === right[index]?.id);
}

function SortableWorkspaceRow({
  workspace,
  index,
  selected,
  onSelect,
}: {
  workspace: Workspace;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: workspace.id,
    index,
    type: "workspace",
    group: "workspaces",
    accept: "workspace",
  });

  return (
    <div
      ref={ref}
      data-testid="workspace-row"
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-transparent pr-1 transition hover:border-border hover:bg-surface-muted",
        isDragging && "border-border bg-surface-muted shadow-sm",
      )}
    >
      <button
        ref={handleRef}
        type="button"
        data-testid="workspace-drag-handle"
        aria-label={`Reorder ${workspace.name}`}
        className="cursor-grab rounded-sm p-1 text-text-muted hover:bg-surface-muted/70 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between rounded-sm px-1.5 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          selected ? "bg-selection text-text" : "text-text-muted hover:text-text",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Boxes className="size-3.5 shrink-0" />
          <span className="truncate">{workspace.name}</span>
        </span>
        {selected && (
          <Check
            data-testid="workspace-selected-indicator"
            className="size-3.5 shrink-0 text-text-muted"
          />
        )}
      </button>
    </div>
  );
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  onSelect,
}: WorkspaceSwitcherProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const workspaces = useQuery(trpc.share.getOwnedWorkspaces.queryOptions());
  const reorderWorkspace = useMutation(trpc.share.reorderWorkspace.mutationOptions());
  const previewRef = useRef<Workspace[] | null>(null);
  const draggingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [preview, setPreview] = useState<Workspace[] | null>(null);
  const savedWorkspaces = workspaces.data ?? [];
  const visibleWorkspaces = preview ?? savedWorkspaces;

  useEffect(() => {
    if (previewRef.current && sameWorkspaceOrder(savedWorkspaces, previewRef.current)) {
      previewRef.current = null;
      setPreview(null);
    }
  }, [savedWorkspaces]);

  function setLocalPreview(next: Workspace[] | null) {
    previewRef.current = next;
    setPreview(next);
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
          <span className="inline-flex items-center gap-2">
            <Boxes className="size-4" />
            Workspaces
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
          <span className="text-xs font-medium text-text-muted">Workspaces</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            data-testid="workspace-add-button"
            onClick={() => {
              setOpen(false);
              setWorkspaceDialogOpen(true);
            }}
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
          <button
            type="button"
            aria-current={activeWorkspaceId === null ? "page" : undefined}
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              activeWorkspaceId === null
                ? "border-border bg-selection text-text"
                : "text-text-muted hover:text-text",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              All workspaces
            </span>
            {activeWorkspaceId === null && (
              <Check
                data-testid="workspace-selected-indicator"
                className="size-3.5 text-text-muted"
              />
            )}
          </button>

          {workspaces.isLoading ? (
            <div className="space-y-1 py-1">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          ) : (
            <DragDropProvider
              onDragStart={() => {
                draggingRef.current = true;
                setLocalPreview(savedWorkspaces);
              }}
              onDragOver={(event) => {
                const { source, target } = event.operation;
                if (!source || !target || source.type !== "workspace" || target.type !== "workspace") return;
                const next = moveWorkspace(
                  previewRef.current ?? savedWorkspaces,
                  String(source.id),
                  String(target.id),
                );
                if (next) setLocalPreview(next);
              }}
              onDragEnd={(event) => {
                draggingRef.current = false;
                if (event.canceled || !event.operation.source || !previewRef.current) {
                  setLocalPreview(null);
                  return;
                }

                const movedId = String(event.operation.source.id);
                const orderKey = movedRowOrderKey(previewRef.current, movedId);
                if (!orderKey) {
                  setLocalPreview(null);
                  return;
                }

                setLocalPreview(previewRef.current.map((workspace) =>
                  workspace.id === movedId
                    ? { ...workspace, orderKey }
                    : workspace,
                ));

                reorderWorkspace.mutate(
                  { id: movedId, orderKey },
                  {
                    onSuccess: () => {
                      void queryClient.invalidateQueries({
                        queryKey: trpc.share.getOwnedWorkspaces.queryKey(),
                      });
                    },
                    onError: () => setLocalPreview(null),
                  },
                );
              }}
            >
              <div className="space-y-0.5">
                {visibleWorkspaces.map((workspace, index) => (
                  <SortableWorkspaceRow
                    key={workspace.id}
                    workspace={workspace}
                    index={index}
                    selected={activeWorkspaceId === workspace.id}
                    onSelect={() => {
                      onSelect(workspace.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}

          {!workspaces.isLoading && savedWorkspaces.length === 0 && (
            <p className="px-2 py-1 text-xs text-text-muted">No workspaces yet.</p>
          )}
        </div>
      </DropdownMenuContent>
      </DropdownMenu>
      <WorkspacesDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
      />
    </>
  );
}
