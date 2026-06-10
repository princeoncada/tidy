// Hand-written app-shell service worker.
// Decision rules mirror lib/sw/app-shell-strategy.ts (the spec - keep in sync).
/* global self, caches */
const APP_SHELL_CACHE_NAME = "tidy-app-shell-v1";
const APP_SHELL_FALLBACK_KEY = "/app-shell";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.method !== "GET" || !sameOrigin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(APP_SHELL_CACHE_NAME);
          cache.put(APP_SHELL_FALLBACK_KEY, response.clone());
          return response;
        } catch (error) {
          const cache = await caches.open(APP_SHELL_CACHE_NAME);
          const fallback = await cache.match(APP_SHELL_FALLBACK_KEY);
          if (fallback) {
            return fallback;
          }
          throw error;
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_SHELL_CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
