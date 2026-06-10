"use client";

import { useEffect } from "react";

import { registerAppShellServiceWorker } from "@/lib/sw/register-service-worker";

export function useAppShellServiceWorker(): void {
  useEffect(() => {
    void registerAppShellServiceWorker();
  }, []);
}
