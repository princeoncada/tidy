import { createClient } from "@/lib/supabase/server";
import { pokeUser } from "@/lib/realtime/poke-server";
import {
  processReplicachePush,
  type ReplicachePushMutation,
} from "@/lib/sync/replicache/push";

function isPushMutation(value: unknown): value is ReplicachePushMutation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const mutation = value as Record<string, unknown>;
  return (
    typeof mutation.id === "number" &&
    Number.isInteger(mutation.id) &&
    mutation.id > 0 &&
    typeof mutation.clientID === "string" &&
    mutation.clientID.length > 0 &&
    typeof mutation.name === "string" &&
    typeof mutation.timestamp === "number" &&
    Number.isFinite(mutation.timestamp)
  );
}

function parsePushRequest(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const request = body as Record<string, unknown>;
  if (
    request.pushVersion !== 1 ||
    typeof request.clientGroupID !== "string" ||
    request.clientGroupID.length === 0 ||
    !Array.isArray(request.mutations) ||
    !request.mutations.every(isPushMutation)
  ) {
    return null;
  }
  return {
    clientGroupID: request.clientGroupID,
    mutations: request.mutations,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parsePushRequest(body);
  if (!parsed) {
    return Response.json(
      { error: "VersionNotSupported", versionType: "push" },
      { status: 400 },
    );
  }

  try {
    const result = await processReplicachePush({
      userId: user.id,
      clientGroupID: parsed.clientGroupID,
      mutations: parsed.mutations,
    });
    if (result.applied > 0) {
      await pokeUser(user.id);
    }
    return Response.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Replicache push failed.";
    const status = message.includes("another user") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}

