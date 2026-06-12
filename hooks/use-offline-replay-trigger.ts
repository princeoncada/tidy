"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { createFlushScheduler } from "@/lib/sync/flush-scheduler";
import {
  flushOfflineWrites,
  isOfflineWriteCaptureEnabled,
  reconcilePendingWritesOnLoad,
} from "@/lib/sync/offline-write-prototype";
import { subscribeToOutboxCaptures } from "@/lib/sync/outbox-capture-events";

export function useOfflineReplayTrigger(): void {
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOfflineWriteCaptureEnabled()) {
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const scheduler = createFlushScheduler({
      flush: async () => {
        const userId = userIdRef.current;
        if (!userId || cancelled) {
          return;
        }
        await flushOfflineWrites({ userId });
      },
    });

    const initialize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          return;
        }

        userIdRef.current = user.id;
        await reconcilePendingWritesOnLoad({ userId: user.id });
        scheduler.flushNow();
      } catch (error) {
        console.error("Offline replay initialization failed", error);
      }
    };

    void initialize();

    const unsubscribe = subscribeToOutboxCaptures((event) => {
      if (event.userId === userIdRef.current) {
        scheduler.schedule();
      }
    });

    const handleOnline = () => {
      scheduler.flushNow();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        scheduler.flushNow();
      }
    };
    const handlePageHide = () => {
      scheduler.flushNow();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      scheduler.cancel();
    };
  }, []);
}
