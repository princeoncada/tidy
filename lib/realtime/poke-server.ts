import { pokeTopicForUser } from "@/lib/realtime/poke-topic";

export async function pokeUser(
  userId: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Server-only service-role key: realtime.messages has RLS enabled (2.0.6) and the
  // anon key cannot INSERT broadcasts, so the trusted server uses the service-role
  // key, which bypasses RLS, to deliver the poke. The user is already authenticated
  // and recipients are authorized upstream in /api/replicache/push.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  try {
    await fetchImpl(`${url}/realtime/v1/api/broadcast`, {
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
          },
        ],
      }),
    });
  } catch {
    // Best-effort doorbell; periodic pull heals missed pokes.
  }
}
