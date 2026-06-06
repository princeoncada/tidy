"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isOfflineWriteCaptureEnabled,
  readSyncStatusSurfaceForUser,
} from "@/lib/sync/offline-write-prototype";
import type { SyncStatusSurface } from "@/lib/sync/sync-status-surface";

const SYNC_STATUS_POLL_INTERVAL_MS = 5000;

export function useSyncStatusSurface(): SyncStatusSurface | null {
  const [surface, setSurface] = useState<SyncStatusSurface | null>(null);
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSurface(null);
        return;
      }
      const next = await readSyncStatusSurfaceForUser({ userId: user.id });
      setSurface(next);
    } catch (error) {
      console.error("Failed to refresh sync status surface", error);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isOfflineWriteCaptureEnabled()) {
      return;
    }

    let cancelled = false;
    const run = () => {
      if (cancelled) {
        return;
      }
      void refresh();
    };

    const initialReadTimeout = window.setTimeout(run, 0);
    window.addEventListener("online", run);
    const intervalId = window.setInterval(run, SYNC_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialReadTimeout);
      window.removeEventListener("online", run);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return surface;
}
