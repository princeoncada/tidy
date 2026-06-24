import "server-only";

type GoTrueAdminUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function fallbackLabel(userId: string): string {
  return `User ${userId.slice(0, 8)}`;
}

function pickLabel(user: GoTrueAdminUser, userId: string): string {
  const metadata = user.user_metadata ?? {};
  const name = metadata["full_name"] ?? metadata["name"];
  if (typeof name === "string" && name.trim()) return name.trim();
  if (typeof user.email === "string" && user.email.trim()) {
    return user.email.trim();
  }
  return fallbackLabel(userId);
}

// Server-only identity directory. The Supabase service-role key bypasses
// GoTrue admin RLS (same trust boundary as lib/realtime/poke-server.ts). Used
// only inside already-authorized member/assignee queries; the client never
// receives a bulk directory. Missing key or failed lookup yields a stable
// id-based fallback label so the UI never blocks on identity resolution.
export async function resolveUserLabels(
  userIds: string[],
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const labels = new Map<string, string>();
  for (const id of unique) labels.set(id, fallbackLabel(id));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return labels;

  await Promise.all(
    unique.map(async (id) => {
      try {
        const response = await fetchImpl(
          `${url}/auth/v1/admin/users/${id}`,
          {
            headers: {
              apikey: serviceRoleKey,
              authorization: `Bearer ${serviceRoleKey}`,
            },
          },
        );
        if (!response.ok) return;
        const user = (await response.json()) as GoTrueAdminUser;
        labels.set(id, pickLabel(user, id));
      } catch {
        // keep the fallback label already seeded above
      }
    }),
  );

  return labels;
}
