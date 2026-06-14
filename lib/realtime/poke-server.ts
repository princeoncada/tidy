import { pokeTopicForUser } from "@/lib/realtime/poke-topic";

export async function pokeUser(
  userId: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;

  try {
    await fetchImpl(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
        authorization: `Bearer ${key}`,
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
