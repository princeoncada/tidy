"use client";

import { useMemo } from "react";

import { useTidyReplicache } from "@/components/ReplicacheProvider";
import { wrapSyncLatencyMutators } from "@/lib/sync/sync-latency-spike";

export function useDashboardMutations() {
  const { rep } = useTidyReplicache();

  return useMemo(
    () => ({
      enabled: Boolean(rep),
      mutate: rep ? wrapSyncLatencyMutators(rep.mutate) : null,
    }),
    [rep],
  );
}
