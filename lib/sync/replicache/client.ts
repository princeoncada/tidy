import {
  Replicache,
  type Pusher,
  type PushResponse,
} from "replicache";

import { replicacheMutators } from "@/lib/sync/replicache/mutators";

export type TidyReplicache = Replicache<typeof replicacheMutators>;

function createPusher(onCorrections: (count: number) => void): Pusher {
  return async (requestBody) => {
    const response = await fetch("/api/replicache/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = undefined;
    }

    const corrections =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "corrections" in responseBody &&
      Array.isArray(responseBody.corrections)
        ? responseBody.corrections.length
        : 0;
    if (corrections > 0) {
      onCorrections(corrections);
    }

    const errorMessage = response.ok
      ? ""
      : typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "string"
        ? responseBody.error
        : `Replicache push failed with HTTP ${response.status}.`;
    const standardResponse =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "error" in responseBody &&
      (responseBody.error === "ClientStateNotFound" ||
        responseBody.error === "VersionNotSupported")
        ? responseBody as PushResponse
        : undefined;

    return {
      ...(standardResponse ? { response: standardResponse } : {}),
      httpRequestInfo: {
        httpStatusCode: response.status,
        errorMessage,
      },
    };
  };
}

export function createReplicacheClient({
  userId,
  onCorrections,
}: {
  userId: string;
  onCorrections: (count: number) => void;
}) {
  return new Replicache({
    name: `tidy:${userId}`,
    schemaVersion: "2.0.4",
    pushURL: "/api/replicache/push",
    pullURL: "/api/replicache/pull",
    pullInterval: 60_000,
    mutators: replicacheMutators,
    pusher: createPusher(onCorrections),
  });
}
