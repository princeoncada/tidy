import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  processPush: vi.fn(),
  getUsersWithListAccess: vi.fn(),
  pokeUser: vi.fn(async (_userId: string) => undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));
vi.mock("@/lib/sync/replicache/push", () => ({
  processReplicachePush: mocks.processPush,
}));
vi.mock("@/lib/sync/permissions", () => ({
  getUsersWithListAccess: mocks.getUsersWithListAccess,
}));
vi.mock("@/lib/realtime/poke-server", () => ({
  pokeUser: mocks.pokeUser,
}));
vi.mock("@/lib/db", () => ({ db: { marker: "db" } }));

import { POST } from "@/app/api/replicache/push/route";

describe("Replicache push route fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mocks.processPush.mockResolvedValue({
      corrections: [],
      applied: 1,
      affectedListIds: ["list-1"],
    });
    mocks.getUsersWithListAccess.mockResolvedValue(
      new Set(["owner-1", "member-1"]),
    );
  });

  it("pokes every affected collaborator and the pushing user", async () => {
    const response = await POST(new Request(
      "http://tidy.test/api/replicache/push",
      {
        method: "POST",
        body: JSON.stringify({
          pushVersion: 1,
          clientGroupID: "group-1",
          mutations: [{
            id: 1,
            clientID: "client-1",
            name: "renameList",
            args: { id: "list-1", name: "Renamed" },
            timestamp: Date.now(),
          }],
        }),
      },
    ));

    expect(response.status).toBe(200);
    expect(mocks.getUsersWithListAccess).toHaveBeenCalledWith(
      expect.anything(),
      ["list-1"],
    );
    expect(mocks.pokeUser.mock.calls.map(([id]) => id).sort()).toEqual([
      "member-1",
      "owner-1",
      "user-1",
    ]);
  });
});
