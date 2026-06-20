import { pokeTopicForUser } from "@/lib/realtime/poke-topic";

export type PokeDeliveryResult =
  | { delivered: true; status: number }
  | { delivered: false; reason: "not-configured" }
  | { delivered: false; reason: "rejected"; status: number }
  | { delivered: false; reason: "error"; error: string };

export async function pokeUser(
  userId: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<PokeDeliveryResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Server-only service-role key: realtime.messages has RLS enabled (2.0.6) and the
  // anon key cannot INSERT broadcasts, so the trusted server uses the service-role
  // key, which bypasses RLS, to deliver the poke. The user is already authenticated
  // and recipients are authorized upstream in /api/replicache/push.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { delivered: false, reason: "not-configured" };
  }

  try {
    const response = await fetchImpl(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: pokeTopicForUser(userId),
            event: "poke",
            payload: { changed: true },
            // Private-channel broadcast: the client subscribes with
            // config.private = true, so the REST message must be marked
            // private to reach that per-user subscription. Omitting it
            // silently dropped the poke and forced ~18s periodic-pull
            // self-heal (3.1.0 spike).
            private: true,
          },
        ],
      }),
    });

    if (!response.ok) {
      // Best-effort doorbell; periodic pull still heals missed pokes. Surface
      // the non-success instead of masking it, so a broken poke path is
      // observable.
      console.warn(
        `[poke] broadcast rejected for user ${userId}: HTTP ${response.status}`,
      );
      return { delivered: false, reason: "rejected", status: response.status };
    }

    return { delivered: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[poke] broadcast failed for user ${userId}: ${message}`);
    return { delivered: false, reason: "error", error: message };
  }
}
