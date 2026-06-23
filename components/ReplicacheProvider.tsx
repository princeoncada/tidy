"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  createReplicacheClient,
  type TidyReplicache,
} from "@/lib/sync/replicache/client";
import { subscribeToPokes } from "@/lib/realtime/poke-client";
import { installPresenceSpikeWindowApi } from "@/lib/realtime/presence-spike";
import { createClient } from "@/lib/supabase/client";
import {
  installSyncLatencySpikeWindowApi,
  recordRuntimeSyncLatencyEvent,
} from "@/lib/sync/sync-latency-spike";

type ReplicacheContextValue = {
  rep: TidyReplicache | null;
  correctionCount: number;
};

const ReplicacheContext = createContext<ReplicacheContextValue>({
  rep: null,
  correctionCount: 0,
});

export function ReplicacheProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [correctionCount, setCorrectionCount] = useState(0);
  const [activeInstance, setActiveInstance] = useState<{
    userId: string;
    rep: TidyReplicache;
  } | null>(null);
  const instanceRef = useRef<{
    userId: string;
    rep: TidyReplicache;
  } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => installSyncLatencySpikeWindowApi(), []);
  useEffect(() => installPresenceSpikeWindowApi({ userId }), [userId]);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (instanceRef.current?.userId !== userId) {
      const staleRep = instanceRef.current?.rep;
      instanceRef.current = null;
      if (staleRep) {
        void staleRep.close().catch(() => {});
      }
    }

    const nextRep =
      instanceRef.current?.rep ??
      createReplicacheClient({
        userId,
        onCorrections: (count) => {
          setCorrectionCount((current) => current + count);
        },
      });
    instanceRef.current = { userId, rep: nextRep };
    setActiveInstance({ userId, rep: nextRep });

    return () => {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        if (instanceRef.current?.rep !== nextRep) return;

        instanceRef.current = null;
        void nextRep.close().catch(() => {});
      }, 0);
    };
  }, [userId]);

  useEffect(() => {
    const rep =
      activeInstance?.userId === userId ? activeInstance.rep : null;
    if (!rep) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const accessToken = session?.access_token;
        if (!accessToken || disposed) return;

        return subscribeToPokes({
          userId,
          accessToken,
          onPoke: () => {
            recordRuntimeSyncLatencyEvent("poke_received");
            void rep.pull().catch(() => {});
          },
        });
      })
      .then((cleanup) => {
        if (!cleanup) return;
        if (disposed) {
          cleanup();
        } else {
          unsubscribe = cleanup;
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [userId, activeInstance]);

  const activeRep =
    activeInstance?.userId === userId ? activeInstance.rep : null;

  if (!activeRep) {
    return null;
  }

  return (
    <ReplicacheContext.Provider value={{ rep: activeRep, correctionCount }}>
      {children}
    </ReplicacheContext.Provider>
  );
}

export function useTidyReplicache() {
  return useContext(ReplicacheContext);
}
