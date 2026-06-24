import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  workspace: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  list: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  shareLink: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  listShare: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  workspaceMember: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const permissionMocks = vi.hoisted(() => ({
  getEffectiveListRole: vi.fn(),
  getEffectiveWorkspaceRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/sync/permissions", () => ({
  canManage: (role: string | null) => role === "OWNER",
  getEffectiveListRole: permissionMocks.getEffectiveListRole,
  getEffectiveWorkspaceRole: permissionMocks.getEffectiveWorkspaceRole,
  rank: (role: string) => ({ VIEWER: 1, EDITOR: 2, OWNER: 3 })[
    role as "VIEWER" | "EDITOR" | "OWNER"
  ],
}));

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { shareRouter } from "@/trpc/routers/shareRouter";

const createCaller = createCallerFactory(shareRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LIST = "33333333-3333-4333-8333-333333333333";

function caller() {
  return createCaller({
    user: { id: USER },
    supabase: {},
  } as unknown as TestTRPCContext);
}

function expectCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(TRPCError);
  expect(error).toMatchObject({ code });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
  permissionMocks.getEffectiveListRole.mockResolvedValue("OWNER");
  permissionMocks.getEffectiveWorkspaceRole.mockResolvedValue("OWNER");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("share router", () => {
  it.each([
    ["revoked", {
      revokedAt: new Date(),
      expiresAt: null,
      list: { userId: OTHER },
    }, "BAD_REQUEST"],
    ["expired", {
      revokedAt: null,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      list: { userId: OTHER },
    }, "BAD_REQUEST"],
    ["self-owned", {
      revokedAt: null,
      expiresAt: null,
      list: { userId: USER },
    }, "BAD_REQUEST"],
  ] as const)("rejects %s list links", async (_label, values, code) => {
    dbMock.shareLink.findUnique.mockResolvedValue({
      resourceType: "LIST",
      role: "EDITOR",
      listId: LIST,
      workspaceId: null,
      workspace: null,
      ...values,
    });

    try {
      await caller().redeemShareLink({ token: "token" });
      throw new Error("Expected redeem to reject");
    } catch (error) {
      expectCode(error, code);
    }
    expect(dbMock.listShare.upsert).not.toHaveBeenCalled();
  });

  it("redeems idempotently without downgrading an existing grant", async () => {
    dbMock.shareLink.findUnique.mockResolvedValue({
      resourceType: "LIST",
      role: "VIEWER",
      listId: LIST,
      workspaceId: null,
      revokedAt: null,
      expiresAt: null,
      list: { userId: OTHER },
      workspace: null,
    });
    dbMock.listShare.findUnique.mockResolvedValue({ role: "EDITOR" });

    await expect(
      caller().redeemShareLink({ token: "token" }),
    ).resolves.toEqual({
      resourceType: "LIST",
      resourceId: LIST,
    });
    expect(dbMock.listShare.upsert).toHaveBeenCalledWith({
      where: { listId_userId: { listId: LIST, userId: USER } },
      update: { role: "EDITOR" },
      create: { listId: LIST, userId: USER, role: "EDITOR" },
    });
  });

  it("enforces owner-only link and member management", async () => {
    permissionMocks.getEffectiveListRole.mockResolvedValueOnce("EDITOR");

    try {
      await caller().createShareLink({
        resourceType: "LIST",
        resourceId: LIST,
        role: "VIEWER",
      });
      throw new Error("Expected link creation to reject");
    } catch (error) {
      expectCode(error, "FORBIDDEN");
    }
    expect(dbMock.shareLink.create).not.toHaveBeenCalled();

    permissionMocks.getEffectiveListRole.mockResolvedValue("OWNER");
    dbMock.listShare.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      caller().updateMemberRole({
        resourceType: "LIST",
        resourceId: LIST,
        userId: OTHER,
        role: "EDITOR",
      }),
    ).resolves.toEqual({ userId: OTHER, role: "EDITOR" });
    expect(dbMock.listShare.updateMany).toHaveBeenCalledWith({
      where: { listId: LIST, userId: OTHER },
      data: { role: "EDITOR" },
    });

    await expect(
      caller().removeMember({
        resourceType: "LIST",
        resourceId: LIST,
        userId: OTHER,
      }),
    ).resolves.toEqual({ userId: OTHER });
    expect(dbMock.listShare.deleteMany).toHaveBeenCalledWith({
      where: { listId: LIST, userId: OTHER },
    });
  });

  it("returns list members with fallback labels", async () => {
    dbMock.list.findUnique.mockResolvedValue({
      userId: USER,
      listShares: [{ userId: OTHER, role: "EDITOR" }],
    });

    await expect(
      caller().listMembers({
        resourceType: "LIST",
        resourceId: LIST,
      }),
    ).resolves.toEqual([
      { userId: USER, role: "OWNER", label: "User 11111111" },
      { userId: OTHER, role: "EDITOR", label: "User 22222222" },
    ]);
  });
});
