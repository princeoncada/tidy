import { randomBytes } from "node:crypto";

import {
  ShareResourceType,
  type ShareRole,
} from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import {
  canManage,
  getEffectiveListRole,
  getEffectiveWorkspaceRole,
  rank,
} from "@/lib/sync/permissions";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { createTRPCRouter, protectedProcedure } from "../init";

const resourceTypeSchema = z.enum(["LIST", "WORKSPACE"]);
const grantRoleSchema = z.enum(["EDITOR", "VIEWER"]);

function resourceIds(
  resourceType: ShareResourceType,
  resourceId: string,
) {
  return resourceType === ShareResourceType.LIST
    ? { listId: resourceId, workspaceId: null }
    : { listId: null, workspaceId: resourceId };
}

async function requireOwner(
  userId: string,
  resourceType: ShareResourceType,
  resourceId: string,
) {
  const role = resourceType === ShareResourceType.LIST
    ? await getEffectiveListRole(db, userId, resourceId)
    : await getEffectiveWorkspaceRole(db, userId, resourceId);

  if (!canManage(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

async function upsertStrongestListRole(
  listId: string,
  userId: string,
  role: ShareRole,
) {
  const existing = await db.listShare.findUnique({
    where: { listId_userId: { listId, userId } },
    select: { role: true },
  });
  const nextRole =
    existing && rank(existing.role) > rank(role) ? existing.role : role;

  await db.listShare.upsert({
    where: { listId_userId: { listId, userId } },
    update: { role: nextRole },
    create: { listId, userId, role: nextRole },
  });
}

async function upsertStrongestWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: ShareRole,
) {
  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  const nextRole =
    existing && rank(existing.role) > rank(role) ? existing.role : role;

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role: nextRole },
    create: { workspaceId, userId, role: nextRole },
  });
}

export const shareRouter = createTRPCRouter({
  createWorkspace: protectedProcedure.input(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(255),
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const existing = await db.workspace.findUnique({
      where: { id: input.id },
      select: { id: true, ownerId: true, name: true },
    });
    if (existing) {
      if (existing.ownerId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return existing;
    }

    return db.workspace.create({
      data: {
        id: input.id,
        name: input.name,
        ownerId: userId,
      },
    });
  }),

  getOwnedWorkspaces: protectedProcedure.query(
    async ({ ctx: { userId } }) =>
      db.workspace.findMany({
        where: { ownerId: userId },
        orderBy: [
          { orderKey: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
        include: {
          lists: {
            where: { userId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, name: true },
          },
        },
      }),
  ),

  reorderWorkspace: protectedProcedure.input(
    z.object({ id: z.uuid(), orderKey: z.string().min(1) }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const workspace = await db.workspace.findUnique({
      where: { id: input.id },
      select: { ownerId: true },
    });
    if (!workspace || workspace.ownerId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.workspace.update({
      where: { id: input.id },
      data: { orderKey: input.orderKey },
      select: { id: true, orderKey: true },
    });
  }),

  renameWorkspace: protectedProcedure.input(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(255),
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const workspace = await db.workspace.findUnique({
      where: { id: input.id },
      select: { ownerId: true },
    });
    if (!workspace || workspace.ownerId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.workspace.update({
      where: { id: input.id },
      data: { name: input.name },
      select: { id: true, name: true },
    });
  }),

  deleteWorkspace: protectedProcedure.input(
    z.object({ id: z.uuid() }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const workspace = await db.workspace.findUnique({
      where: { id: input.id },
      select: { ownerId: true },
    });
    if (!workspace || workspace.ownerId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await db.workspace.delete({ where: { id: input.id } });
    return { id: input.id };
  }),

  getOwnedLists: protectedProcedure.query(async ({ ctx: { userId } }) =>
    db.list.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        workspaceId: true,
      },
    })
  ),

  setListWorkspace: protectedProcedure.input(
    z.object({
      listId: z.uuid(),
      workspaceId: z.uuid().nullable(),
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const list = await db.list.findUnique({
      where: { id: input.listId },
      select: { userId: true },
    });
    if (!list || list.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    if (input.workspaceId) {
      const workspace = await db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerId: true },
      });
      if (!workspace || workspace.ownerId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
    }

    return db.list.update({
      where: { id: input.listId },
      data: { workspaceId: input.workspaceId },
      select: { id: true, workspaceId: true },
    });
  }),

  createShareLink: protectedProcedure.input(
    z.object({
      resourceType: resourceTypeSchema,
      resourceId: z.uuid(),
      role: grantRoleSchema,
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    await requireOwner(userId, input.resourceType, input.resourceId);
    const token = randomBytes(32).toString("hex");

    await db.shareLink.create({
      data: {
        token,
        resourceType: input.resourceType,
        role: input.role,
        createdById: userId,
        ...resourceIds(input.resourceType, input.resourceId),
      },
    });

    return { token };
  }),

  listShareLinks: protectedProcedure.input(
    z.object({
      resourceType: resourceTypeSchema,
      resourceId: z.uuid(),
    }),
  ).query(async ({ ctx: { userId }, input }) => {
    await requireOwner(userId, input.resourceType, input.resourceId);
    return db.shareLink.findMany({
      where: {
        resourceType: input.resourceType,
        revokedAt: null,
        ...(input.resourceType === ShareResourceType.LIST
          ? { listId: input.resourceId }
          : { workspaceId: input.resourceId }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        token: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }),

  revokeShareLink: protectedProcedure.input(
    z.object({ token: z.string().min(1) }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const link = await db.shareLink.findUnique({
      where: { token: input.token },
      select: {
        createdById: true,
        resourceType: true,
        listId: true,
        workspaceId: true,
        revokedAt: true,
      },
    });
    if (!link) throw new TRPCError({ code: "NOT_FOUND" });

    const resourceId = link.listId ?? link.workspaceId;
    const owner =
      resourceId &&
      canManage(
        link.resourceType === ShareResourceType.LIST
          ? await getEffectiveListRole(db, userId, resourceId)
          : await getEffectiveWorkspaceRole(db, userId, resourceId),
      );
    if (link.createdById !== userId && !owner) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    if (link.revokedAt) return { token: input.token };

    await db.shareLink.update({
      where: { token: input.token },
      data: { revokedAt: new Date() },
    });
    return { token: input.token };
  }),

  redeemShareLink: protectedProcedure.input(
    z.object({ token: z.string().min(1) }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    const link = await db.shareLink.findUnique({
      where: { token: input.token },
      select: {
        resourceType: true,
        role: true,
        listId: true,
        workspaceId: true,
        revokedAt: true,
        expiresAt: true,
        list: { select: { userId: true } },
        workspace: { select: { ownerId: true } },
      },
    });
    if (!link) throw new TRPCError({ code: "NOT_FOUND" });
    if (link.revokedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This share link has been revoked.",
      });
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This share link has expired.",
      });
    }

    if (link.resourceType === ShareResourceType.LIST && link.listId) {
      if (link.list?.userId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this list.",
        });
      }
      await upsertStrongestListRole(link.listId, userId, link.role);
      return {
        resourceType: link.resourceType,
        resourceId: link.listId,
      };
    }

    if (
      link.resourceType === ShareResourceType.WORKSPACE &&
      link.workspaceId
    ) {
      if (link.workspace?.ownerId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this workspace.",
        });
      }
      await upsertStrongestWorkspaceRole(
        link.workspaceId,
        userId,
        link.role,
      );
      return {
        resourceType: link.resourceType,
        resourceId: link.workspaceId,
      };
    }

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "The shared resource no longer exists.",
    });
  }),

  listMembers: protectedProcedure.input(
    z.object({
      resourceType: resourceTypeSchema,
      resourceId: z.uuid(),
    }),
  ).query(async ({ ctx: { userId }, input }) => {
    await requireOwner(userId, input.resourceType, input.resourceId);

    if (input.resourceType === ShareResourceType.LIST) {
      const list = await db.list.findUnique({
        where: { id: input.resourceId },
        select: {
          userId: true,
          listShares: {
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            select: { userId: true, role: true },
          },
        },
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });
      return [
        { userId: list.userId, role: "OWNER" as const },
        ...list.listShares,
      ];
    }

    const workspace = await db.workspace.findUnique({
      where: { id: input.resourceId },
      select: {
        ownerId: true,
        members: {
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          select: { userId: true, role: true },
        },
      },
    });
    if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });
    return [
      { userId: workspace.ownerId, role: "OWNER" as const },
      ...workspace.members,
    ];
  }),

  updateMemberRole: protectedProcedure.input(
    z.object({
      resourceType: resourceTypeSchema,
      resourceId: z.uuid(),
      userId: z.uuid(),
      role: grantRoleSchema,
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    await requireOwner(userId, input.resourceType, input.resourceId);
    if (input.userId === userId) {
      throw new TRPCError({ code: "BAD_REQUEST" });
    }

    if (input.resourceType === ShareResourceType.LIST) {
      const updated = await db.listShare.updateMany({
        where: { listId: input.resourceId, userId: input.userId },
        data: { role: input.role },
      });
      if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    } else {
      const updated = await db.workspaceMember.updateMany({
        where: {
          workspaceId: input.resourceId,
          userId: input.userId,
        },
        data: { role: input.role },
      });
      if (updated.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    }

    return { userId: input.userId, role: input.role };
  }),

  removeMember: protectedProcedure.input(
    z.object({
      resourceType: resourceTypeSchema,
      resourceId: z.uuid(),
      userId: z.uuid(),
    }),
  ).mutation(async ({ ctx: { userId }, input }) => {
    await requireOwner(userId, input.resourceType, input.resourceId);
    if (input.userId === userId) {
      throw new TRPCError({ code: "BAD_REQUEST" });
    }

    if (input.resourceType === ShareResourceType.LIST) {
      await db.listShare.deleteMany({
        where: { listId: input.resourceId, userId: input.userId },
      });
    } else {
      await db.workspaceMember.deleteMany({
        where: {
          workspaceId: input.resourceId,
          userId: input.userId,
        },
      });
    }
    return { userId: input.userId };
  }),
});
