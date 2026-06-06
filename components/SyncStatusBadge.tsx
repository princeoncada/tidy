"use client";

import { useSyncStatusSurface } from "@/hooks/use-sync-status-surface";

const STATE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  syncing: "bg-blue-100 text-blue-800 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  synced: "bg-emerald-100 text-emerald-800 border-emerald-200",
  idle: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const SyncStatusBadge = () => {
  const surface = useSyncStatusSurface();

  if (!surface) {
    return null;
  }

  if (surface.visibleCount === 0 && !surface.hasActionableFailure) {
    return null;
  }

  return (
    <span
      data-testid="sync-status-badge"
      data-state={surface.state}
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATE_STYLES[surface.state] ?? STATE_STYLES.idle}`}
    >
      <span className="font-semibold">{surface.label}</span>
      <span className="text-[11px] opacity-80">{surface.description}</span>
      {surface.hasActionableFailure ? (
        <span data-testid="sync-status-failed-count" className="font-semibold">
          {surface.counts.failed} failed
        </span>
      ) : null}
    </span>
  );
};

export default SyncStatusBadge;
