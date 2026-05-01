import { createTRPCRouter } from '../init';
import { userRouter } from './userRouter';
import { listRouter } from './listRouter';
import { listItemRouter } from './listItemRouter';
import { testRouter } from './testRouter';
import { tagRouter } from './tagRouter';
import { viewRouter } from './viewRouter';

export const appRouter = createTRPCRouter({
  test: testRouter,
  user: userRouter,
  list: listRouter,
  listItem: listItemRouter,
  tag: tagRouter,
  view: viewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
