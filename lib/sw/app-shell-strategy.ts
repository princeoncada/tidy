export const APP_SHELL_CACHE_NAME = "tidy-app-shell-v1";
export const APP_SHELL_FALLBACK_KEY = "/app-shell";

export function isPrecachableStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/static/");
}

export function isNavigationRequest(request: { mode?: string }): boolean {
  return request.mode === "navigate";
}

export function shouldBypassRequest(method: string, sameOrigin: boolean): boolean {
  return method !== "GET" || !sameOrigin;
}
