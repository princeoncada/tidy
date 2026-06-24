export function isPresenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRESENCE_ENABLED === "true";
}
