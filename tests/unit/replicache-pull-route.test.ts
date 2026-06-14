import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readViews: vi.fn(),
  readAllLists: vi.fn(),
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
  readViewsForUser: mocks.readViews,
  readAllListsSnapshotForUser: mocks.readAllLists,
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
      viewTags: [],
      viewLists: [{ listId: "list-1", order: 0 }],
    };
    mocks.readViews.mockResolvedValue([allListsView]);
    mocks.readAllLists.mockResolvedValue({
      view: allListsView,
      lists: [{
        id: "list-1",
        userId: "user-1",
        name: "Inbox",
        order: 0,
        createdAt: now,
        updatedAt: now,
        listItems: [],
        listTags: [],
      }],
    });
    mocks.readTags.mockResolvedValue([]);

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
    expect(mocks.readTags).toHaveBeenCalledWith("user-1");
    expect(body.lastMutationIDChanges).toEqual({ "client-1": 7 });
    expect(body.cookie).toBe("group-1:1");
    expect(body.patch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "put", key: "list/list-1" }),
        expect.objectContaining({
          op: "put",
          key: "metadata/selectedView",
          value: "view-all",
        }),
      ]),
    );
  });
});
