import type { Prisma } from "@/app/generated/prisma/client";
import {
  readAllListsSnapshotForUser,
  readTagsForUser,
  readViewsForUser,
} from "@/lib/dashboard/server-read";
import { db } from "@/lib/db";
import {
  buildReplicacheClientView,
  diffReplicacheClientViews,
  nextReplicacheCookie,
  toReplicacheClientViewRecordHashes,
  type ReplicacheClientViewRecordHashes,
} from "@/lib/sync/replicache/pull-cvr";
import { createClient } from "@/lib/supabase/server";

const CVR_RETENTION_COUNT = 20;

type PullTrackingTransaction = {
  replicacheClientGroup: {
    findUnique(args: unknown): Promise<{ id: string; userId: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
  replicacheClient: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      lastMutationID: number;
    }>>;
  };
  replicacheClientViewRecord: {
    findFirst(args: unknown): Promise<{
      id: string;
      entities: unknown;
      createdAt: Date;
    } | null>;
    findMany(args: unknown): Promise<Array<{ id: string }>>;
    create(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
};

type PullDatabase = {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

function parsePullRequest(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const request = body as Record<string, unknown>;
  if (
    request.pullVersion !== 1 ||
    typeof request.clientGroupID !== "string" ||
    request.clientGroupID.length === 0 ||
    !(
      request.cookie === null ||
      request.cookie === undefined ||
      typeof request.cookie === "string"
    )
  ) {
    return null;
  }

  return {
    clientGroupID: request.clientGroupID,
    cookie: typeof request.cookie === "string" ? request.cookie : null,
  };
}

function asHashRecord(value: unknown): ReplicacheClientViewRecordHashes {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
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

  const parsed = parsePullRequest(body);
  if (!parsed) {
    return Response.json(
      { error: "VersionNotSupported", versionType: "pull" },
      { status: 400 },
    );
  }

  const views = await readViewsForUser(user.id);
  const [allLists, tags] = await Promise.all([
    readAllListsSnapshotForUser(user.id),
    readTagsForUser(user.id),
  ]);
  if (!allLists) {
    return Response.json(
      { error: "Unable to build the owned dashboard view." },
      { status: 500 },
    );
  }

  const current = buildReplicacheClientView({ views, allLists, tags });
  const database = db as unknown as PullDatabase;

  try {
    const response = await database.$transaction(async (prismaTx) => {
      const tx = prismaTx as unknown as PullTrackingTransaction;
      const group = await tx.replicacheClientGroup.findUnique({
        where: { id: parsed.clientGroupID },
        select: { id: true, userId: true },
      });
      if (group && group.userId !== user.id) {
        throw new Error("Replicache client group belongs to another user.");
      }
      if (!group) {
        await tx.replicacheClientGroup.create({
          data: { id: parsed.clientGroupID, userId: user.id },
        });
      }

      const [previousRecord, latestRecord, clients] = await Promise.all([
        parsed.cookie
          ? tx.replicacheClientViewRecord.findFirst({
              where: {
                id: parsed.cookie,
                clientGroupId: parsed.clientGroupID,
              },
            })
          : Promise.resolve(null),
        tx.replicacheClientViewRecord.findFirst({
          where: { clientGroupId: parsed.clientGroupID },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        tx.replicacheClient.findMany({
          where: { clientGroupId: parsed.clientGroupID },
          select: { id: true, lastMutationID: true },
        }),
      ]);
      const cookie = nextReplicacheCookie(
        latestRecord?.id,
        parsed.clientGroupID,
      );
      const previous = asHashRecord(previousRecord?.entities);
      const diff = diffReplicacheClientViews({ previous, current });
      const patch =
        parsed.cookie && !previousRecord
          ? [{ op: "clear" as const }, ...diff]
          : diff;
      const entities = toReplicacheClientViewRecordHashes(current);

      await tx.replicacheClientViewRecord.create({
        data: {
          id: cookie,
          clientGroupId: parsed.clientGroupID,
          entities,
        },
      });

      const superseded = await tx.replicacheClientViewRecord.findMany({
        where: { clientGroupId: parsed.clientGroupID },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: CVR_RETENTION_COUNT,
        select: { id: true },
      });
      if (superseded.length > 0) {
        await tx.replicacheClientViewRecord.deleteMany({
          where: { id: { in: superseded.map((record) => record.id) } },
        });
      }

      return {
        cookie,
        lastMutationIDChanges: Object.fromEntries(
          clients.map((client) => [client.id, client.lastMutationID]),
        ),
        patch,
      };
    });

    return Response.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Replicache pull failed.";
    const status = message.includes("another user") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
