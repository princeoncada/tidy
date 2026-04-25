'use client';

// <-- hooks can only be used in client components
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';

export function ClientGreeting() {
  const trpc = useTRPC();
  const greeting = useQuery(trpc.hello.queryOptions({ text: 'prince' }));
  const me = useQuery(trpc.getUser.queryOptions())
  if (!greeting.data) return <div>Loading...</div>;
  return <div>{me.data?.user?.id}</div>;
}