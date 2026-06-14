export const APP_SHELL_CACHE_PREFIX = "tidy-app-shell-";
export const APP_SHELL_CACHE_NAME = `${APP_SHELL_CACHE_PREFIX}v2`;
export const APP_SHELL_FALLBACK_KEY = "/app-shell";

export function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
}

export function isPrecachableStaticAsset(
  pathname: string,
  hostname = "",
): boolean {
  return !isLocalDevelopmentHost(hostname) &&
    pathname.startsWith("/_next/static/");
}

export function isNavigationRequest(request: { mode?: string }): boolean {
  return request.mode === "navigate";
}

export function shouldBypassRequest(method: string, sameOrigin: boolean): boolean {
  return method !== "GET" || !sameOrigin;
}
