import { db } from "@/lib/db"
import { createTRPCRouter, protectedProcedure } from "../init"
import z from "zod"
import { TRPCError } from "@trpc/server"
import {
  ensureAllListsView,
  ensureDefaultView,
} from "./viewHelpers"


export const listRouter = createTRPCRouter({
  createList: protectedProcedure.input(
    z.object({
      id: z.uuid(),
      name: z.string().trim().max(255),
      viewId: z.uuid().optional(),
    })
  ).mutation(async ({ ctx: { userId }, input }) => {
    return await db.$transaction(async (tx) => {
      const existingList = await tx.list.findFirst({
        where: {
          id: input.id,
          userId,
        },
        include: {
          listTags: {
            include: {
              tag: true,
            },
          }
        },
      });

      if (existingList) {
        return existingList;
      }

      const allListsView = await ensureAllListsView(userId, tx);
      const selectedDefaultView = input.viewId
        ? null
        : await ensureDefaultView(userId, tx);
      const selectedViewId = input.viewId ?? selectedDefaultView!.id;
      const selectedView = await tx.view.findFirst({
        where: {
          id: selectedViewId,
          userId,
        },
        include: {
          viewTags: true,
        },
      });

      if (!selectedView) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const topAllViewList = await tx.viewList.findFirst({
        where: { viewId: allListsView.id },
        orderBy: { order: "asc" },
        select: { order: true },
      });
      
      const viewTagIds =
        selectedView.type === "CUSTOM"
          ? selectedView.viewTags.map((viewTag) => viewTag.tagId)
          : [];
      const createdList = await tx.list.create({
        data: {
          id: input.id,
          name: input.name,
          userId,
          listTags: viewTagIds.length > 0
            ? {
              createMany: {
                data: viewTagIds.map((tagId) => ({ tagId })),
                skipDuplicates: true,
              },
            }
            : undefined,
        },
        include: {
          listTags: {
            include: {
              tag: true,
            },
          },
          listItems: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      await tx.viewList.createMany({
        data: [{
          viewId: allListsView.id,
          listId: createdList.id,
          order: topAllViewList ? topAllViewList.order - 1 : 0,
        }],
        skipDuplicates: true,
      });

      return createdList;
    });
  }),
  getLists: protectedProcedure.query(async ({ ctx: { userId } }) => {
    const lists = await db.list.findMany({
      where: {
        userId
      },
    })

    return lists
  }),
  getListsWithItems: protectedProcedure.query(async ({ ctx: { userId } }) => {
    const lists = await db.list.findMany({
      where: {
        userId
      },
      include: {
        listTags: {
          include: {
            tag: true,
          },
        },
        listItems: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    return lists
  }),
  renameList: protectedProcedure.input(
    z.object({
      id: z.uuid(),
      name: z.string().trim().max(255)
    })
  ).mutation(async ({ ctx: { userId }, input: { id, name } }) => {
    const renamedList = await db.list.updateManyAndReturn({
      where: {
        id,
        userId
      },
      data: {
        name
      }
    })

    if (renamedList.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    return renamedList[0]
  }),
  deleteList: protectedProcedure.input(
    z.object({
      listId: z.uuid()
    })
  ).mutation(async ({ ctx, input }) => {
    await db.list.deleteMany({
      where: {
        id: input.listId,
        userId: ctx.userId,
      },
    });

    return { id: input.listId };
  }),
})
