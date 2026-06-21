export function sameViewOrder<T extends { id: string }>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  if (left.length !== right.length) return false;

  return left.every((view, index) => view.id === right[index]?.id);
}
