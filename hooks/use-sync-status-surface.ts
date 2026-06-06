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

    void refresh();

    const handleOnline = () => {
      void refresh();
    };
    window.addEventListener("online", handleOnline);
    const intervalId = window.setInterval(() => {
      void refresh();
    }, SYNC_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return surface;
}
