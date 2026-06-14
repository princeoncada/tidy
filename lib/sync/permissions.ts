import type {
  Prisma,
  ShareRole,
} from "@/app/generated/prisma/client";
import { db } from "@/lib/db";

export type { ShareRole } from "@/app/generated/prisma/client";

export type PermissionDatabase = Prisma.TransactionClient | typeof db;

const ROLE_RANK: Record<ShareRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function rank(role: ShareRole): number {
  return ROLE_RANK[role];
}

export function canRead(role: ShareRole | null): role is ShareRole {
  return role !== null;
}

export function canEditContent(role: ShareRole | null): boolean {
  return role === "OWNER" || role === "EDITOR";
}

export function canManage(role: ShareRole | null): boolean {
  return role === "OWNER";
}

function strongestRole(roles: Array<ShareRole | null | undefined>) {
  return roles.reduce<ShareRole | null>(
    (strongest, role) =>
      role && (!strongest || rank(role) > rank(strongest))
        ? role
        : strongest,
    null,
  );
}

export async function getEffectiveWorkspaceRole(
  database: PermissionDatabase,
  userId: string,
  workspaceId: string,
): Promise<ShareRole | null> {
  const workspace = await database.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!workspace) return null;
  if (workspace.ownerId === userId) return "OWNER";
  return workspace.members[0]?.role ?? null;
}

export async function getEffectiveListRole(
  database: PermissionDatabase,
  userId: string,
  listId: string,
): Promise<ShareRole | null> {
  const list = await database.list.findUnique({
    where: { id: listId },
    select: {
      userId: true,
      listShares: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
      workspace: {
        select: {
          ownerId: true,
          members: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!list) return null;

  return strongestRole([
    list.userId === userId ? "OWNER" : null,
    list.listShares?.[0]?.role,
    list.workspace?.ownerId === userId ? "OWNER" : null,
    list.workspace?.members[0]?.role,
  ]);
}

export async function getAccessibleListIdsForUser(
  database: PermissionDatabase,
  userId: string,
): Promise<string[]> {
  const lists = await database.list.findMany({
    where: {
      userId: { not: userId },
      OR: [
        { listShares: { some: { userId } } },
        { workspace: { is: { ownerId: userId } } },
        { workspace: { is: { members: { some: { userId } } } } },
      ],
    },
    select: { id: true },
  });

  return lists.map((list) => list.id);
}

export async function getUsersWithListAccess(
  database: PermissionDatabase,
  listIds: string[],
): Promise<Set<string>> {
  if (listIds.length === 0) return new Set();

  const lists = await database.list.findMany({
    where: { id: { in: [...new Set(listIds)] } },
    select: {
      userId: true,
      listShares: {
        select: { userId: true },
      },
      workspace: {
        select: {
          ownerId: true,
          members: {
            select: { userId: true },
          },
        },
      },
    },
  });

  const users = new Set<string>();
  for (const list of lists) {
    users.add(list.userId);
    for (const share of list.listShares) users.add(share.userId);
    if (list.workspace) {
      users.add(list.workspace.ownerId);
      for (const member of list.workspace.members) users.add(member.userId);
    }
  }
  return users;
}
