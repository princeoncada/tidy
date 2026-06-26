"use client";

import { useQuery } from "@tanstack/react-query";
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
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.history.listMutationHistory.queryOptions({}),
    enabled: open,
  });
  const entries = query.data?.map(formatMutationLedgerEntry) ?? [];

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
                  <time
                    dateTime={entry.at}
                    className="shrink-0 text-right text-xs text-muted-foreground"
                  >
                    {new Date(entry.at).toLocaleString()}
                  </time>
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
