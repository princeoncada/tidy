import { describe, expect, it } from "vitest";

import {
  APP_SHELL_CACHE_NAME,
  APP_SHELL_FALLBACK_KEY,
  isLocalDevelopmentHost,
  isNavigationRequest,
  isPrecachableStaticAsset,
  shouldBypassRequest,
} from "@/lib/sw/app-shell-strategy";

describe("app shell strategy", () => {
  it("exposes stable cache identifiers", () => {
    expect(APP_SHELL_CACHE_NAME).toBe("tidy-app-shell-v2");
    expect(APP_SHELL_FALLBACK_KEY).toBe("/app-shell");
  });

  it("identifies immutable Next.js static assets", () => {
    expect(isPrecachableStaticAsset("/_next/static/chunk.js")).toBe(true);
    expect(
      isPrecachableStaticAsset("/_next/static/chunk.js", "localhost"),
    ).toBe(false);
    expect(isPrecachableStaticAsset("/dashboard")).toBe(false);
  });

  it("identifies local development hosts", () => {
    expect(isLocalDevelopmentHost("localhost")).toBe(true);
    expect(isLocalDevelopmentHost("127.0.0.1")).toBe(true);
    expect(isLocalDevelopmentHost("example.com")).toBe(false);
  });

  it("identifies navigation requests", () => {
    expect(isNavigationRequest({ mode: "navigate" })).toBe(true);
    expect(isNavigationRequest({ mode: "cors" })).toBe(false);
    expect(isNavigationRequest({})).toBe(false);
  });

  it("bypasses non-GET and cross-origin requests", () => {
    expect(shouldBypassRequest("POST", true)).toBe(true);
    expect(shouldBypassRequest("GET", false)).toBe(true);
    expect(shouldBypassRequest("GET", true)).toBe(false);
  });
});
