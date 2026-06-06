"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  flushOfflineWrites,
  isOfflineWriteCaptureEnabled,
  reconcilePendingWritesOnLoad,
} from "@/lib/sync/offline-write-prototype";

export function useOfflineReplayTrigger(): void {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isOfflineWriteCaptureEnabled()) {
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const runReplay = async () => {
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          return;
        }

        await reconcilePendingWritesOnLoad({ userId: user.id });
        await flushOfflineWrites({ userId: user.id });
      } catch (error) {
        console.error("Offline replay trigger failed", error);
      } finally {
        runningRef.current = false;
      }
    };

    void runReplay();

    const handleOnline = () => {
      void runReplay();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
