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
  isReplicacheRenderEnabled,
  type TidyReplicache,
} from "@/lib/sync/replicache/client";

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

  useEffect(() => {
    if (!isReplicacheRenderEnabled()) return;

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

  const activeRep =
    activeInstance?.userId === userId ? activeInstance.rep : null;

  if (isReplicacheRenderEnabled() && !activeRep) {
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
