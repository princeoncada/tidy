import z from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "../init";

export const tagColorSchema = z.enum([
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);

export const tagRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx: { userId } }) => {
    return await db.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: {
        listTags: true,
      },
    });
  }),
  create: protectedProcedure.input(z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(255),
    color: tagColorSchema.default("gray"),
  })).mutation(async ({ ctx: { userId }, input }) => {
    return await db.tag.create({
      data: {
        id: input.id,
        name: input.name,
        color: input.color,
        userId,
      },
    });
  }),
  update: protectedProcedure.input(z.object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    color: tagColorSchema.optional(),
  })).mutation(async ({ ctx: { userId }, input }) => {
    const updatedTags = await db.tag.updateManyAndReturn({
      where: {
        id: input.id,
        userId,
      },
      data: {
        name: input.name,
        color: input.color,
      },
    });

    if (updatedTags.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return updatedTags[0];
  }),
  delete: protectedProcedure.input(z.object({
    id: z.uuid(),
  })).mutation(async ({ ctx: { userId }, input: { id } }) => {
    const result = await db.tag.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return {
      deleted: result.count > 0,
    };
  }),
  addToList: protectedProcedure.input(z.object({
    listId: z.uuid(),
    tagId: z.uuid(),
  })).mutation(async ({ ctx: { userId }, input: { listId, tagId } }) => {
    const [list, tag] = await Promise.all([
      db.list.findFirst({
        where: { id: listId, userId },
        select: { id: true },
      }),
      db.tag.findFirst({
        where: { id: tagId, userId },
        select: { id: true },
      }),
    ]);

    if (!list || !tag) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return await db.listTag.upsert({
      where: {
        listId_tagId: {
          listId,
          tagId,
        },
      },
      update: {},
      create: {
        listId,
        tagId,
      },
    });
  }),
  removeFromList: protectedProcedure.input(z.object({
    listId: z.uuid(),
    tagId: z.uuid(),
  })).mutation(async ({ ctx: { userId }, input: { listId, tagId } }) => {
    const result = await db.listTag.deleteMany({
      where: {
        listId,
        tagId,
        list: {
          userId,
        },
        tag: {
          userId,
        },
      },
    });

    return {
      detached: result.count > 0,
    };
  }),
})
