import { db } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedProcedure } from '../init';

export const appRouter = createTRPCRouter({
  hello: baseProcedure.input(
    z.object({
      text: z.string()
    })
  ).query((opts) => {
    return {
      greeting: `hello ${opts.input.text}`
    }
  }),
  getUser: protectedProcedure.query(({
    ctx
  }) => {
    return {
      user: ctx.user
    }
  }),
  getUserId: protectedProcedure.query(({
    ctx
  }) => {
    return ctx.userId
  }),
  createList: protectedProcedure.input(
    z.object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(20),
    })
  ).mutation(async ({ ctx: { userId }, input }) => {
    const topList = await db.list.findFirst({
      where: { userId },
      orderBy: { order: "asc" },
      select: { order: true },
    });

    return await db.list.create({
      data: {
        id: input.id,
        name: input.name,
        userId,
        order: topList ? topList.order - 1 : 0,
      },
    });
  }),
  getLists: protectedProcedure.query(async ({ ctx: { userId } }) => {
    const lists = await db.list.findMany({
      where: {
        userId
      },
      orderBy: {
        order: 'asc'
      }
    })

    return lists
  }),
  getListsWithItems: protectedProcedure.query(async ({ ctx: { userId } }) => {
    const lists = await db.list.findMany({
      where: {
        userId
      },
      orderBy: {
        order: 'asc'
      },
      include: {
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
      name: z.string().min(1).max(20).trim()
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
  ).mutation(async ({ input }) => {
    return await db.$transaction(async (tx) => {
      await tx.listItem.deleteMany({
        where: {
          listId: input.listId,
        },
      });

      await tx.list.delete({
        where: {
          id: input.listId,
        },
      });
    });
  }),
  getListItems: protectedProcedure.input(z.object({
    listId: z.uuid()
  })).query(async ({ input: { listId } }) => {
    const listItems = await db.listItem.findMany({
      where: {
        listId
      },
      orderBy: {
        order: 'asc'
      }
    })

    return listItems
  }),
  createListItem: protectedProcedure.input(z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(20),
    listId: z.uuid(),
  })).mutation(async ({ ctx, input }) => {
    const parentList = await db.list.findFirst({
      where: {
        id: input.listId,
        userId: ctx.userId,
      },
      select: { id: true },
    });

    if (!parentList) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "List does not belong to this user.",
      });
    }

    const topItem = await db.listItem.findFirst({
      where: { listId: input.listId },
      orderBy: { order: "asc" },
      select: { order: true },
    });

    return await db.listItem.create({
      data: {
        id: input.id,
        name: input.name,
        listId: input.listId,
        order: topItem ? topItem.order - 1 : 0,
        completed: false,
      },
    });
  }),
  renameListItem: protectedProcedure.input(z.object({
    name: z.string().nonempty().trim().max(20),
    id: z.uuid()
  })).mutation(async ({ input: { id, name } }) => {
    const renamedListItem = await db.listItem.update({
      where: {
        id
      },
      data: {
        name
      }
    })

    if (!renamedListItem) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    return renamedListItem
  }),
  deleteListItem: protectedProcedure.input(z.object({
    id: z.uuid()
  })).mutation(async ({ input: { id } }) => {
    const result = await db.listItem.deleteMany({
      where: { id },
    });

    return {
      deleted: result.count > 0,
    };
  }),
  setCompletionListItem: protectedProcedure.input(z.object({
    id: z.uuid(),
    completed: z.boolean()
  })).mutation(async ({ input: { id, completed } }) => {
    const listItem = await db.listItem.update({
      where: {
        id
      },
      data: {
        completed
      }
    })

    return listItem
  }),
  reorderLists: protectedProcedure.input(z.object({
    lists: z.array(
      z.object({
        id: z.uuid(),
        order: z.number().int().min(0)
      })
    )
  })).mutation(async ({ ctx: { userId }, input }) => {
    const ids = input.lists.map((list) => list.id)

    const ownedLists = await db.list.findMany({
      where: {
        id: { in: ids },
        userId
      },
      select: { id: true }
    })

    if (ownedLists.length !== ids.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Some lists do not belong to this user."
      })
    }

    await db.$transaction(
      input.lists.map((list) =>
        db.list.update({
          where: { id: list.id },
          data: { order: list.order }
        })
      )
    )

    return { success: true }
  }),
  reorderListItems: protectedProcedure.input(z.object({
    items: z.array(
      z.object({
        id: z.uuid(),
        listId: z.uuid(),
        order: z.number().int().min(0)
      })
    )
  })).mutation(async ({ ctx: { userId }, input }) => {
    const itemIds = input.items.map((item) => item.id)

    const ownedItems = await db.listItem.findMany({
      where: {
        id: { in: itemIds },
        parentList: {
          userId,
        },
      },
      select: { id: true },
    });

    if (ownedItems.length !== itemIds.length) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Some items do not belong to this user.",
      });
    }

    await db.$transaction(
      input.items.map((item) =>
        db.listItem.update({
          where: { id: item.id },
          data: {
            listId: item.listId,
            order: item.order,
          },
        })
      )
    );

    return { success: true };
  })
});

// export type definition of API
export type AppRouter = typeof appRouter;