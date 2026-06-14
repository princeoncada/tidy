import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_SHELL_CACHE_NAME,
  APP_SHELL_CACHE_PREFIX,
} from "@/lib/sw/app-shell-strategy";
import { registerAppShellServiceWorker } from "@/lib/sw/register-service-worker";

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");

describe("app shell service worker registration", () => {
  const unregister = vi.fn();
  const getRegistration = vi.fn();
  const deleteCache = vi.fn();
  const listCaches = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED", "false");
    unregister.mockReset();
    unregister.mockResolvedValue(true);
    getRegistration.mockReset();
    getRegistration.mockResolvedValue({ unregister });
    deleteCache.mockReset();
    deleteCache.mockResolvedValue(true);
    listCaches.mockReset();
    listCaches.mockResolvedValue([
      `${APP_SHELL_CACHE_PREFIX}v1`,
      APP_SHELL_CACHE_NAME,
      "unrelated-cache",
    ]);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration,
        register: vi.fn(),
      },
    });
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { delete: deleteCache, keys: listCaches },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalServiceWorker) {
      Object.defineProperty(
        navigator,
        "serviceWorker",
        originalServiceWorker,
      );
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    if (originalCaches) {
      Object.defineProperty(globalThis, "caches", originalCaches);
    } else {
      Reflect.deleteProperty(globalThis, "caches");
    }
  });

  it("removes stale registrations and cached assets when disabled", async () => {
    await registerAppShellServiceWorker();

    expect(getRegistration).toHaveBeenCalledWith("/");
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith(`${APP_SHELL_CACHE_PREFIX}v1`);
    expect(deleteCache).toHaveBeenCalledWith(APP_SHELL_CACHE_NAME);
    expect(deleteCache).not.toHaveBeenCalledWith("unrelated-cache");
  });
});
