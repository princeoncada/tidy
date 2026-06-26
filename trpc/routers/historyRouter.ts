import z from "zod";

import { db } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "../init";

export const historyRouter = createTRPCRouter({
  listMutationHistory: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).optional(),
    }).optional())
    .query(async ({ ctx: { userId }, input }) => {
      return db.mutationLedgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          name: true,
          affectedListIds: true,
          createdAt: true,
        },
      });
    }),
});
