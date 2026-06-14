"use client";

import { useMemo } from "react";

import { useTidyReplicache } from "@/components/ReplicacheProvider";

export function useDashboardMutations() {
  const { rep } = useTidyReplicache();

  return useMemo(
    () => ({
      enabled: Boolean(rep),
      mutate: rep?.mutate ?? null,
    }),
    [rep],
  );
}
