import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readViews: vi.fn(),
  readAllLists: vi.fn(),
  readAccessibleLists: vi.fn(),
  readTags: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

vi.mock("@/lib/dashboard/server-read", () => ({
  readReplicacheViewsForUser: mocks.readViews,
  readReplicacheAllListsSnapshotForUser: mocks.readAllLists,
  readReplicacheAccessibleListsForUser: mocks.readAccessibleLists,
  readTagsForUser: mocks.readTags,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/replicache/pull/route";

const now = new Date("2026-06-14T12:00:00.000Z");

describe("Replicache pull route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const allListsView = {
      id: "view-all",
      userId: "user-1",
      name: "All Lists",
      order: 0,
      type: "ALL_LISTS",
      isDefault: true,
      matchMode: "ALL",
      createdAt: now,
      updatedAt: now,
      orderKey: null,
      viewTags: [],
      viewLists: [{ listId: "list-1", order: 0, orderKey: null }],
    };
    mocks.readViews.mockResolvedValue([allListsView]);
    mocks.readAllLists.mockResolvedValue({
      view: allListsView,
      lists: [{
        id: "list-1",
        userId: "user-1",
        name: "Inbox",
        order: 0,
        orderKey: null,
        createdAt: now,
        updatedAt: now,
        listItems: [],
        listTags: [],
      }],
    });
    mocks.readTags.mockResolvedValue([]);
    mocks.readAccessibleLists.mockResolvedValue([{
      id: "list-shared",
      userId: "user-2",
      name: "Shared",
      order: 0,
      orderKey: null,
      accessRole: "EDITOR",
      createdAt: now,
      updatedAt: now,
      listItems: [],
      listTags: [],
      workspaceId: null,
    }]);

    const tx = {
      replicacheClientGroup: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => undefined),
      },
      replicacheClient: {
        findMany: vi.fn(async () => [{
          id: "client-1",
          lastMutationID: 7,
        }]),
      },
      replicacheClientViewRecord: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => undefined),
        deleteMany: vi.fn(async () => undefined),
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );
  });

  it("scopes source reads to the authenticated user and returns mutation ids", async () => {
    const response = await POST(new Request("http://tidy.test/api/replicache/pull", {
      method: "POST",
      body: JSON.stringify({
        pullVersion: 1,
        clientGroupID: "group-1",
        cookie: null,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readViews).toHaveBeenCalledWith("user-1");
    expect(mocks.readAllLists).toHaveBeenCalledWith("user-1");
    expect(mocks.readAccessibleLists).toHaveBeenCalledWith("user-1");
    expect(mocks.readTags).toHaveBeenCalledWith("user-1");
    expect(body.lastMutationIDChanges).toEqual({ "client-1": 7 });
    expect(body.cookie).toBe("group-1:0000000000000001");
    expect(body.patch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "put", key: "list/list-1" }),
        expect.objectContaining({
          op: "put",
          key: "list/list-shared",
          value: expect.objectContaining({ accessRole: "EDITOR" }),
        }),
        expect.objectContaining({
          op: "put",
          key: "viewList/view-all/list-shared",
        }),
        expect.objectContaining({
          op: "put",
          key: "metadata/selectedView",
          value: "view-all",
        }),
      ]),
    );
  });

  it("returns unique lexicographically increasing cookies across 11 pulls", async () => {
    const records: Array<{
      id: string;
      entities: unknown;
      createdAt: Date;
    }> = [];
    const createdIds = new Set<string>();
    let groupCreated = false;
    const tx = {
      replicacheClientGroup: {
        findUnique: vi.fn(async () =>
          groupCreated ? { id: "group-1", userId: "user-1" } : null
        ),
        create: vi.fn(async () => {
          groupCreated = true;
        }),
      },
      replicacheClient: {
        findMany: vi.fn(async () => []),
      },
      replicacheClientViewRecord: {
        findFirst: vi.fn(async (args: {
          where: { id?: string; clientGroupId: string };
        }) => {
          if (args.where.id) {
            return records.find((record) => record.id === args.where.id) ??
              null;
          }
          return records.at(-1) ?? null;
        }),
        findMany: vi.fn(async () => []),
        create: vi.fn(async (args: {
          data: {
            id: string;
            clientGroupId: string;
            entities: unknown;
          };
        }) => {
          expect(createdIds.has(args.data.id)).toBe(false);
          createdIds.add(args.data.id);
          records.push({
            id: args.data.id,
            entities: args.data.entities,
            createdAt: new Date(now.getTime() + records.length),
          });
        }),
        deleteMany: vi.fn(async () => undefined),
      },
    };
    mocks.transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );

    const cookies: string[] = [];
    let previousCookie: string | null = null;
    for (let pull = 0; pull < 11; pull += 1) {
      const response = await POST(
        new Request("http://tidy.test/api/replicache/pull", {
          method: "POST",
          body: JSON.stringify({
            pullVersion: 1,
            clientGroupID: "group-1",
            cookie: previousCookie,
          }),
        }),
      );
      const body = await response.json();
      const cookie = String(body.cookie);

      expect(response.status).toBe(200);
      expect(cookie).toMatch(/^group-1:\d{16}$/);
      if (previousCookie) {
        expect(previousCookie < cookie).toBe(true);
      }
      cookies.push(cookie);
      previousCookie = cookie;
    }

    expect(cookies).toHaveLength(11);
    expect(createdIds.size).toBe(11);
  });
});
