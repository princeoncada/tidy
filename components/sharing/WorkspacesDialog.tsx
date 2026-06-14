"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTidyReplicache } from "@/components/ReplicacheProvider";
import { useTRPC } from "@/trpc/client";

import { ShareDialog } from "./ShareDialog";

export function WorkspacesDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { rep } = useTidyReplicache();
  const workspaces = useQuery({
    ...trpc.share.getOwnedWorkspaces.queryOptions(),
    enabled: open,
  });
  const lists = useQuery({
    ...trpc.share.getOwnedLists.queryOptions(),
    enabled: open,
  });
  const createWorkspace = useMutation(
    trpc.share.createWorkspace.mutationOptions(),
  );
  const setListWorkspace = useMutation(
    trpc.share.setListWorkspace.mutationOptions(),
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.share.getOwnedWorkspaces.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.share.getOwnedLists.queryKey(),
      }),
      rep?.pull(),
    ]);
  }

  async function handleCreate() {
    const workspaceName = name.trim();
    if (!workspaceName) return;
    await createWorkspace.mutateAsync({
      id: crypto.randomUUID(),
      name: workspaceName,
    });
    setName("");
    await refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Boxes />
          Workspaces
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Workspaces</DialogTitle>
          <DialogDescription>
            Group owned lists and share the whole group.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
              }}
            />
          </div>
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || createWorkspace.isPending}
          >
            <Plus />
            Create
          </Button>
        </div>

        <div className="space-y-3">
          {workspaces.data?.map((workspace) => (
            <div key={workspace.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {workspace.lists.length} lists
                  </p>
                </div>
                <ShareDialog
                  resourceType="WORKSPACE"
                  resourceId={workspace.id}
                  title={workspace.name}
                />
              </div>

              <div className="space-y-2">
                {lists.data?.map((list) => (
                  <label
                    key={list.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={list.workspaceId === workspace.id}
                      onChange={(event) => {
                        void setListWorkspace
                          .mutateAsync({
                            listId: list.id,
                            workspaceId: event.target.checked
                              ? workspace.id
                              : null,
                          })
                          .then(refresh);
                      }}
                    />
                    <span>{list.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {workspaces.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No workspaces yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
