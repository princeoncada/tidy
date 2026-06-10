"use client";

import { useAppShellServiceWorker } from "@/hooks/use-app-shell-service-worker";

export function AppShellServiceWorker() {
  useAppShellServiceWorker();
  return null;
}
