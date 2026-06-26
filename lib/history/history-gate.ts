export function isHistoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HISTORY_ENABLED === "true";
}
