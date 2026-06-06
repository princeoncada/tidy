import { describe, expect, it } from "vitest";

import { resolveOutboxOperationConflict } from "@/lib/sync/conflict-resolution";

const clientOperation = {
  updatedAt: "2026-06-06T10:00:00.000Z",
};

describe("offline replay conflict resolution", () => {
  it("applies the client operation when no server snapshot exists", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: clientOperation,
        serverSnapshot: null,
      }),
    ).toMatchObject({ resolution: "apply", winner: "client" });
  });

  it("applies the client operation when client updatedAt is newer", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: clientOperation,
        serverSnapshot: {
          entityServerId: "server-list-1",
          updatedAt: "2026-06-06T09:59:59.000Z",
        },
      }),
    ).toMatchObject({ resolution: "apply", winner: "client" });
  });

  it("skips the client operation when server updatedAt is newer", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: clientOperation,
        serverSnapshot: {
          entityServerId: "server-list-1",
          updatedAt: "2026-06-06T10:00:01.000Z",
        },
      }),
    ).toMatchObject({ resolution: "skip", winner: "server" });
  });

  it("skips the client operation on equal timestamps", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: clientOperation,
        serverSnapshot: {
          entityServerId: "server-list-1",
          updatedAt: "2026-06-06T10:00:00.000Z",
        },
      }),
    ).toMatchObject({ resolution: "skip", winner: "server" });
  });

  it("skips the client operation when the server timestamp is null", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: clientOperation,
        serverSnapshot: {
          entityServerId: "server-list-1",
          updatedAt: null,
        },
      }),
    ).toMatchObject({ resolution: "skip", winner: "server" });
  });

  it("skips the client operation when the client timestamp is unparseable", () => {
    expect(
      resolveOutboxOperationConflict({
        operation: { updatedAt: "not-a-date" },
        serverSnapshot: {
          entityServerId: "server-list-1",
          updatedAt: "2026-06-06T10:00:00.000Z",
        },
      }),
    ).toMatchObject({ resolution: "skip", winner: "server" });
  });

  it("returns identical results for identical inputs", () => {
    const input = {
      operation: clientOperation,
      serverSnapshot: {
        entityServerId: "server-list-1",
        updatedAt: "2026-06-06T10:00:01.000Z",
      },
    };

    expect(resolveOutboxOperationConflict(input)).toEqual(
      resolveOutboxOperationConflict(input),
    );
  });
});
