import { describe, expect, it, vi } from "vitest";

import {
  processReplicachePush,
  type ReplicachePushDatabase,
} from "@/lib/sync/replicache/push";

const permissionMocks = vi.hoisted(() => ({
  getEffectiveListRole: vi.fn(),
}));

vi.mock("@/lib/sync/permissions", () => ({
  canEditContent: (role: string | null) =>
    role === "OWNER" || role === "EDITOR",
  getEffectiveListRole: permissionMocks.getEffectiveListRole,
}));

function createPushDatabase(lastMutationID = 0, listOwner = "user-2") {
  permissionMocks.getEffectiveListRole.mockReset();
  permissionMocks.getEffectiveListRole.mockResolvedValue(
    listOwner === "user-1" ? "OWNER" : null,
  );
  const client = {
    id: "client-1",
    clientGroupId: "group-1",
    lastMutationID,
  };
  const tx = {
    $executeRawUnsafe: vi.fn(async () => 0),
    replicacheClientGroup: {
      findUnique: vi.fn(async () => ({
        id: "group-1",
        userId: "user-1",
      })),
      create: vi.fn(),
    },
    replicacheClient: {
      findUnique: vi.fn(async () => client),
      create: vi.fn(),
      update: vi.fn(async ({ data }: { data: { lastMutationID: number } }) => {
        client.lastMutationID = data.lastMutationID;
        return client;
      }),
    },
    list: {
      findUnique: vi.fn(async () => ({
        userId: listOwner,
        name: "Foreign",
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    listItem: {
      findUnique: vi.fn(async () => null),
    },
  };
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)),
  } as unknown as ReplicachePushDatabase;

  return { client, database, tx };
}

describe("Replicache push ordering", () => {
  it("skips applied mutations, applies the next id, and stops on a gap", async () => {
    const { client, database } = createPushDatabase(1);

    const result = await processReplicachePush({
      userId: "user-1",
      clientGroupID: "group-1",
      mutations: [
        {
          id: 1,
          clientID: "client-1",
          name: "unknown-old",
          args: {},
          timestamp: Date.now(),
        },
        {
          id: 2,
          clientID: "client-1",
          name: "unknown-next",
          args: {},
          timestamp: Date.now(),
        },
        {
          id: 4,
          clientID: "client-1",
          name: "unknown-gap",
          args: {},
          timestamp: Date.now(),
        },
      ],
      database,
      runEffects: vi.fn(async () => undefined),
    });

    expect(client.lastMutationID).toBe(2);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]).toMatchObject({ mutationID: 2 });
    expect(result.applied).toBe(1);
  });

  it("reports zero applied mutations when every mutation is already applied", async () => {
    const { database } = createPushDatabase(2);

    const result = await processReplicachePush({
      userId: "user-1",
      clientGroupID: "group-1",
      mutations: [
        {
          id: 1,
          clientID: "client-1",
          name: "unknown-old",
          args: {},
          timestamp: Date.now(),
        },
        {
          id: 2,
          clientID: "client-1",
          name: "unknown-current",
          args: {},
          timestamp: Date.now(),
        },
      ],
      database,
      runEffects: vi.fn(async () => undefined),
    });

    expect(result.applied).toBe(0);
    expect(result.corrections).toEqual([]);
  });

  it("advances lastMutationID atomically for an ownership rejection", async () => {
    const { client, database, tx } = createPushDatabase();

    const result = await processReplicachePush({
      userId: "user-1",
      clientGroupID: "group-1",
      mutations: [{
        id: 1,
        clientID: "client-1",
        name: "renameList",
        args: {
          id: "list-1",
          name: "No access",
          now: "2026-06-14T12:00:00.000Z",
        },
        timestamp: Date.parse("2026-06-14T12:00:00.000Z"),
      }],
      database,
      runEffects: vi.fn(async () => undefined),
    });

    expect(tx.list.updateMany).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "ROLLBACK TO SAVEPOINT replicache_mutation",
    );
    expect(client.lastMutationID).toBe(1);
    expect(result.corrections[0]?.messages).toContain(
      "List update requires edit access.",
    );
    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });

  it("commits a successful data write with the lastMutationID advance", async () => {
    const { client, database, tx } = createPushDatabase(0, "user-1");

    const result = await processReplicachePush({
      userId: "user-1",
      clientGroupID: "group-1",
      mutations: [{
        id: 1,
        clientID: "client-1",
        name: "renameList",
        args: {
          id: "list-1",
          name: "Renamed",
          now: "2026-06-14T12:00:00.000Z",
        },
        timestamp: Date.parse("2026-06-14T12:00:00.000Z"),
      }],
      database,
      runEffects: vi.fn(async () => undefined),
    });

    expect(result.corrections).toEqual([]);
    expect(tx.list.updateMany).toHaveBeenCalledWith({
      where: { id: "list-1" },
      data: { name: "Renamed" },
    });
    expect(result.affectedListIds).toEqual(["list-1"]);
    expect(client.lastMutationID).toBe(1);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });
});
