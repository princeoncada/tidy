import { db } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedProcedure } from '../init';
import { userRouter } from './userRouter';
import { listRouter } from './listRouter';
import { listItemRouter } from './listItemRouter';
import { testRouter } from './testRouter';
import { tagRouter } from './tagRouter';

export const appRouter = createTRPCRouter({
  test: testRouter,
  user: userRouter,
  list: listRouter,
  listItem: listItemRouter,
  tag: tagRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;
