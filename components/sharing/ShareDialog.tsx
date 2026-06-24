"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

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
import { absoluteUrl } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type ResourceType = "LIST" | "WORKSPACE";
type GrantRole = "EDITOR" | "VIEWER";

export function ShareDialog({
  resourceType,
  resourceId,
  title,
  trigger,
}: {
  resourceType: ResourceType;
  resourceId: string;
  title: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<GrantRole>("VIEWER");
  const [createdUrl, setCreatedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = { resourceType, resourceId };
  const linksQuery = useQuery({
    ...trpc.share.listShareLinks.queryOptions(input),
    enabled: open,
  });
  const membersQuery = useQuery({
    ...trpc.share.listMembers.queryOptions(input),
    enabled: open,
  });
  const createLink = useMutation(
    trpc.share.createShareLink.mutationOptions(),
  );
  const revokeLink = useMutation(
    trpc.share.revokeShareLink.mutationOptions(),
  );
  const updateMember = useMutation(
    trpc.share.updateMemberRole.mutationOptions(),
  );
  const removeMember = useMutation(
    trpc.share.removeMember.mutationOptions(),
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.share.listShareLinks.queryKey(input),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.share.listMembers.queryKey(input),
      }),
    ]);
  }

  async function handleCreateLink() {
    const result = await createLink.mutateAsync({
      ...input,
      role,
    });
    setCreatedUrl(absoluteUrl(`/share/${result.token}`));
    setCopied(false);
    await refresh();
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Link2 />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {title}</DialogTitle>
          <DialogDescription>
            Create an invite link or manage existing access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`share-role-${resourceId}`}>Link role</Label>
              <select
                id={`share-role-${resourceId}`}
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as GrantRole)
                }
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="VIEWER">Viewer</option>
                <option value="EDITOR">Editor</option>
              </select>
            </div>
            <Button
              onClick={() => void handleCreateLink()}
              disabled={createLink.isPending}
            >
              Create link
            </Button>
          </div>

          {createdUrl && (
            <div className="flex gap-2">
              <Input readOnly value={createdUrl} />
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Copy share link"
                onClick={() => void copyUrl(createdUrl)}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Active links</p>
            {linksQuery.data?.length ? (
              linksQuery.data.map((link) => {
                const url = absoluteUrl(`/share/${link.token}`);
                return (
                  <div
                    key={link.token}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <span className="flex-1 truncate text-xs">
                      {link.role.toLowerCase()} link
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Copy share link"
                      onClick={() => void copyUrl(url)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="destructive"
                      aria-label="Revoke share link"
                      disabled={revokeLink.isPending}
                      onClick={() => {
                        void revokeLink
                          .mutateAsync({ token: link.token })
                          .then(refresh);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">
                No active links.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Members</p>
            {membersQuery.data?.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  title={member.userId}
                >
                  {member.label ?? member.userId}
                </span>
                {member.role === "OWNER" ? (
                  <span className="text-xs font-medium">Owner</span>
                ) : (
                  <>
                    <select
                      value={member.role}
                      onChange={(event) => {
                        void updateMember
                          .mutateAsync({
                            ...input,
                            userId: member.userId,
                            role: event.target.value as GrantRole,
                          })
                          .then(refresh);
                      }}
                      className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </select>
                    <Button
                      size="icon-xs"
                      variant="destructive"
                      aria-label="Remove member"
                      disabled={removeMember.isPending}
                      onClick={() => {
                        void removeMember
                          .mutateAsync({
                            ...input,
                            userId: member.userId,
                          })
                          .then(refresh);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
