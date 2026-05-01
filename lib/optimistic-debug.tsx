"use client";

import { Profiler, useEffect, useRef, type ProfilerOnRenderCallback, type ReactNode } from "react";

const isDev = process.env.NODE_ENV !== "production";

type MeasureDetails = Record<string, unknown>;

function payloadSize(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

export function measureOptimisticEvent(name: string, details: MeasureDetails = {}) {
  if (!isDev) return;

  console.debug("[optimistic-debug]", name, details);
}

export function measureCacheWrite(name: string, payload: unknown) {
  if (!isDev) return;

  measureOptimisticEvent("cache-write", {
    name,
    bytes: payloadSize(payload),
  });
}

export function measureRequest(name: string, details: MeasureDetails = {}) {
  if (!isDev) return;

  measureOptimisticEvent("request", {
    name,
    ...details,
  });
}

export function useRenderMeasure(name: string) {
  const rendersRef = useRef(0);

  useEffect(() => {
    if (!isDev) return;

    rendersRef.current += 1;
    measureOptimisticEvent("render", {
      name,
      count: rendersRef.current,
    });
  });
}

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration
) => {
  if (!isDev) return;

  measureOptimisticEvent("profiler", {
    id,
    phase,
    actualDuration: Number(actualDuration.toFixed(2)),
    baseDuration: Number(baseDuration.toFixed(2)),
  });
};

export function OptimisticProfiler({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  if (!isDev) return children;

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
