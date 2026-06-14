import { APP_SHELL_CACHE_PREFIX } from "@/lib/sw/app-shell-strategy";

export function isAppShellServiceWorkerEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED === "true"
  );
}

export async function registerAppShellServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    if (!isAppShellServiceWorkerEnabled()) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      await registration?.unregister();
      if (typeof caches !== "undefined") {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith(APP_SHELL_CACHE_PREFIX))
            .map((name) => caches.delete(name)),
        );
      }
      return;
    }

    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (error) {
    console.error("App shell service worker registration failed", error);
  }
}
