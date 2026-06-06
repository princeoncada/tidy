import { createClient } from "@/lib/supabase/server";
import { validateSyncEndpointRequest } from "@/lib/sync/sync-endpoint-contract";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, errors: ["Unauthorized."] }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const result = validateSyncEndpointRequest(body, { authenticatedUserId: user.id });

  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  // 1.9.7 boundary: validate + authenticate + acknowledge only.
  // Applying operations to the database is deferred to 1.9.9 (conflict
  // resolution) and 1.9.10 (source-of-truth decision).
  return Response.json({ ok: true }, { status: 200 });
}
