import { pokeTopicForUser } from "@/lib/realtime/poke-topic";
import { createClient } from "@/lib/supabase/client";

export function subscribeToPokes({
  userId,
  onPoke,
}: {
  userId: string;
  onPoke: () => void;
}): () => void {
  const client = createClient();
  const channel = client
    .channel(pokeTopicForUser(userId), {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "poke" }, () => onPoke())
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
