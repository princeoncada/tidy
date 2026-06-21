import { keyBetween } from "@/lib/sync/fractional-index";

export function sameViewOrder<T extends { id: string }>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  if (left.length !== right.length) return false;

  return left.every((view, index) => view.id === right[index]?.id);
}

export function movedRowOrderKey<T extends { id: string; orderKey: string | null }>(
  rows: readonly T[],
  movedId: string,
): string | null {
  const movedIndex = rows.findIndex((row) => row.id === movedId);
  if (movedIndex < 0) return null;

  return keyBetween(
    movedIndex > 0 ? rows[movedIndex - 1]?.orderKey ?? null : null,
    movedIndex < rows.length - 1
      ? rows[movedIndex + 1]?.orderKey ?? null
      : null,
  );
}
