import { pokeTopicForUser } from "@/lib/realtime/poke-topic";
import { createClient } from "@/lib/supabase/client";

export function subscribeToPokes({
  userId,
  accessToken,
  onPoke,
}: {
  userId: string;
  accessToken: string;
  onPoke: () => void;
}): Promise<() => void> {
  const client = createClient();
  return client.realtime.setAuth(accessToken).then(() => {
    const channel = client
      .channel(pokeTopicForUser(userId), {
        config: {
          private: true,
          broadcast: { self: false },
        },
      })
      .on("broadcast", { event: "poke" }, () => onPoke())
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  });
}
