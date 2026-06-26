"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
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
import { formatMutationLedgerEntry } from "@/lib/history/history-format";
import { isHistoryEnabled } from "@/lib/history/history-gate";
import { useTRPC } from "@/trpc/client";

export default function HistoryPanel() {
  if (!isHistoryEnabled()) return null;

  return <EnabledHistoryPanel />;
}

function EnabledHistoryPanel() {
  const [open, setOpen] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const historyInput = {};
  const query = useQuery({
    ...trpc.history.listMutationHistory.queryOptions(historyInput),
    enabled: open,
  });
  const revert = useMutation(
    trpc.revert.revertToLedgerEntry.mutationOptions({
      onMutate: () => setRevertError(null),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.history.listMutationHistory.queryKey(historyInput),
        });
      },
      onError: (error) => setRevertError(error.message),
    }),
  );
  const entries = query.data?.map(formatMutationLedgerEntry) ?? [];

  function handleRevert(entryId: string) {
    if (!window.confirm("Revert your dashboard to this history entry?")) {
      return;
    }
    revert.mutate({ entryId });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Clock />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
          <DialogDescription>
            Recent changes from your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {revertError && (
            <p className="text-sm text-destructive">{revertError}</p>
          )}
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">
                      {entry.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.detail}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <time
                      dateTime={entry.at}
                      className="text-right text-xs text-muted-foreground"
                    >
                      {new Date(entry.at).toLocaleString()}
                    </time>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={revert.isPending}
                      onClick={() => handleRevert(entry.id)}
                    >
                      Revert to here
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No history yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
