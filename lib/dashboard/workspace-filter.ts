export function filterListsByWorkspace<
  T extends { workspaceId: string | null },
>(lists: readonly T[], activeWorkspaceId: string | null): T[] {
  if (activeWorkspaceId === null) return [...lists];

  return lists.filter((list) => list.workspaceId === activeWorkspaceId);
}
