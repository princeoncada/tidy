"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Check, Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string | null;
  onSelect: (id: string | null) => void;
};

function WorkspaceSwitcherSkeleton() {
  return (
    <Card className="mt-3 w-full border-border/80 bg-surface/90 py-0 shadow-none">
      <CardHeader className="px-3 py-3">
        <CardTitle className="inline-flex items-center gap-1.5 text-sm">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-4 w-20" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  onSelect,
}: WorkspaceSwitcherProps) {
  const trpc = useTRPC();
  const workspaces = useQuery(trpc.share.getOwnedWorkspaces.queryOptions());

  if (workspaces.isLoading) return <WorkspaceSwitcherSkeleton />;

  const entries = [
    { id: null, name: "All workspaces", icon: Layers },
    ...(workspaces.data ?? []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      icon: Boxes,
    })),
  ];

  return (
    <Card className="mt-3 w-full border-border/80 bg-surface/90 py-0 shadow-none">
      <CardHeader className="px-3 py-3">
        <CardTitle className="inline-flex items-center gap-1.5 text-sm">
          <Boxes className="size-3.5 text-text-muted" />
          Workspaces
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-0.5 px-3 pb-3 pt-0">
        {entries.map((entry) => {
          const selected = activeWorkspaceId === entry.id;
          const Icon = entry.icon;

          return (
            <button
              key={entry.id ?? "all-workspaces"}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(entry.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition hover:border-border hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-border bg-selection text-text"
                  : "text-text-muted hover:text-text",
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{entry.name}</span>
              </span>
              {selected && (
                <Check
                  data-testid="workspace-selected-indicator"
                  className="size-3.5 shrink-0 text-text-muted"
                />
              )}
            </button>
          );
        })}

        {workspaces.data?.length === 0 && (
          <p className="px-2 pt-1 text-xs text-text-muted">
            No workspaces yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
