import { describe, expect, it, vi } from "vitest";

import {
  canEditContent,
  canManage,
  canRead,
  getAccessibleListIdsForUser,
  getEffectiveListRole,
  getEffectiveWorkspaceRole,
  getUsersWithListAccess,
  rank,
} from "@/lib/sync/permissions";

function permissionDb() {
  return {
    list: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  };
}

describe("sharing permissions", () => {
  it("ranks roles and exposes capability gates", () => {
    expect(rank("OWNER")).toBeGreaterThan(rank("EDITOR"));
    expect(rank("EDITOR")).toBeGreaterThan(rank("VIEWER"));
    expect(canRead("VIEWER")).toBe(true);
    expect(canEditContent("VIEWER")).toBe(false);
    expect(canEditContent("EDITOR")).toBe(true);
    expect(canManage("EDITOR")).toBe(false);
    expect(canManage("OWNER")).toBe(true);
  });

  it.each([
    ["owner", {
      userId: "user-1",
      listShares: [],
      workspace: null,
    }, "OWNER"],
    ["list share", {
      userId: "user-2",
      listShares: [{ role: "EDITOR" }],
      workspace: null,
    }, "EDITOR"],
    ["workspace owner", {
      userId: "user-2",
      listShares: [],
      workspace: { ownerId: "user-1", members: [] },
    }, "OWNER"],
    ["workspace member", {
      userId: "user-2",
      listShares: [],
      workspace: {
        ownerId: "user-3",
        members: [{ role: "VIEWER" }],
      },
    }, "VIEWER"],
    ["no access", {
      userId: "user-2",
      listShares: [],
      workspace: null,
    }, null],
  ] as const)("resolves %s access", async (_label, row, expected) => {
    const database = permissionDb();
    database.list.findUnique.mockResolvedValue(row);

    await expect(
      getEffectiveListRole(database as never, "user-1", "list-1"),
    ).resolves.toBe(expected);
  });

  it("uses the stronger direct or workspace grant", async () => {
    const database = permissionDb();
    database.list.findUnique.mockResolvedValue({
      userId: "user-2",
      listShares: [{ role: "VIEWER" }],
      workspace: {
        ownerId: "user-3",
        members: [{ role: "EDITOR" }],
      },
    });

    await expect(
      getEffectiveListRole(database as never, "user-1", "list-1"),
    ).resolves.toBe("EDITOR");
  });

  it("resolves workspace owner, member, and no access", async () => {
    const database = permissionDb();
    database.workspace.findUnique
      .mockResolvedValueOnce({ ownerId: "user-1", members: [] })
      .mockResolvedValueOnce({
        ownerId: "user-2",
        members: [{ role: "EDITOR" }],
      })
      .mockResolvedValueOnce(null);

    await expect(
      getEffectiveWorkspaceRole(database as never, "user-1", "workspace-1"),
    ).resolves.toBe("OWNER");
    await expect(
      getEffectiveWorkspaceRole(database as never, "user-1", "workspace-2"),
    ).resolves.toBe("EDITOR");
    await expect(
      getEffectiveWorkspaceRole(database as never, "user-1", "workspace-3"),
    ).resolves.toBeNull();
  });

  it("returns accessible non-owned ids and all poke recipients", async () => {
    const database = permissionDb();
    database.list.findMany
      .mockResolvedValueOnce([{ id: "list-1" }, { id: "list-2" }])
      .mockResolvedValueOnce([{
        userId: "owner-1",
        listShares: [{ userId: "shared-1" }],
        workspace: {
          ownerId: "workspace-owner",
          members: [{ userId: "member-1" }],
        },
      }]);

    await expect(
      getAccessibleListIdsForUser(database as never, "user-1"),
    ).resolves.toEqual(["list-1", "list-2"]);
    await expect(
      getUsersWithListAccess(database as never, ["list-1"]),
    ).resolves.toEqual(new Set([
      "owner-1",
      "shared-1",
      "workspace-owner",
      "member-1",
    ]));
  });
});
