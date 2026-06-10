export function isAppShellServiceWorkerEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED === "true"
  );
}

export async function registerAppShellServiceWorker(): Promise<void> {
  if (!isAppShellServiceWorkerEnabled()) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (error) {
    console.error("App shell service worker registration failed", error);
  }
}
