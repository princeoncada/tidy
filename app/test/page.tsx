import { ClientGreeting } from '@/trpc/client-greeting';
import { HydrateClient } from '@/trpc/server';

export default function Page() {
  return (
    <HydrateClient>
      <ClientGreeting />
    </HydrateClient>
  );
}