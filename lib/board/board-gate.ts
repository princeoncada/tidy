export function isBoardEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BOARD_ENABLED === "true";
}
