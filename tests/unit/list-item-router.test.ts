import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({}));

const permissionMocks = vi.hoisted(() => ({
  getEffectiveListRole: vi.fn(),
  getUsersWithListAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/sync/permissions", () => ({
  canRead: (role: string | null) => role !== null,
  getEffectiveListRole: permissionMocks.getEffectiveListRole,
  getUsersWithListAccess: permissionMocks.getUsersWithListAccess,
}));

import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { listItemRouter } from "@/trpc/routers/listItemRouter";

const createCaller = createCallerFactory(listItemRouter);
type TestTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const USER = "11111111-1111-4111-8111-111111111111";
const LIST = "22222222-2222-4222-8222-222222222222";

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

describe("list item router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    permissionMocks.getEffectiveListRole.mockResolvedValue("VIEWER");
    permissionMocks.getUsersWithListAccess.mockResolvedValue(
      new Set(["33333333-3333-4333-8333-333333333333", USER]),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns assignable members for a reader", async () => {
    await expect(
      caller().getAssignableMembers({ listId: LIST }),
    ).resolves.toEqual({
      currentUserId: USER,
      members: [
        {
          userId: USER,
          label: "User 11111111",
        },
        {
          userId: "33333333-3333-4333-8333-333333333333",
          label: "User 33333333",
        },
      ],
    });

    expect(permissionMocks.getEffectiveListRole).toHaveBeenCalledWith(
      dbMock,
      USER,
      LIST,
    );
    expect(permissionMocks.getUsersWithListAccess).toHaveBeenCalledWith(
      dbMock,
      [LIST],
    );
  });

  it("throws forbidden for a non-reader", async () => {
    permissionMocks.getEffectiveListRole.mockResolvedValueOnce(null);

    try {
      await caller().getAssignableMembers({ listId: LIST });
      throw new Error("Expected getAssignableMembers to reject");
    } catch (error) {
      expectCode(error, "FORBIDDEN");
    }

    expect(permissionMocks.getUsersWithListAccess).not.toHaveBeenCalled();
  });
});
