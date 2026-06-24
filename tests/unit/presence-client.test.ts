import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAuth: vi.fn(async () => undefined),
  channel: vi.fn(),
  removeChannel: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "access-token" } },
      })),
    },
    realtime: { setAuth: mocks.setAuth },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

import {
  diffRosters,
  PresenceEventBuffer,
  PresenceRoom,
  rosterFromPresenceState,
} from "@/lib/realtime/presence-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("presence roster transforms", () => {
  it("dedupes presence metas by user id with the newest meta winning", () => {
    expect(
      rosterFromPresenceState({
        "client-a": [
          {
            userId: "user-1",
            clientKey: "client-a",
            cursorX: 10,
            cursorY: 20,
            typing: false,
            at: 100,
          },
          {
            userId: "user-1",
            clientKey: "client-b",
            cursorX: 30,
            cursorY: 40,
            typing: true,
            at: 200,
          },
        ],
        "client-c": [
          {
            userId: "user-2",
            clientKey: "client-c",
            at: 150,
          },
        ],
      }),
    ).toEqual([
      {
        userId: "user-1",
        clientKey: "client-b",
        cursorX: 30,
        cursorY: 40,
        typing: true,
        at: 200,
      },
      {
        userId: "user-2",
        clientKey: "client-c",
        at: 150,
      },
    ]);
  });

  it("diffs roster joins and leaves by user id", () => {
    expect(
      diffRosters(
        [
          { userId: "user-1", clientKey: "client-a", at: 100 },
          { userId: "user-2", clientKey: "client-b", at: 100 },
        ],
        [
          { userId: "user-2", clientKey: "client-b", at: 200 },
          { userId: "user-3", clientKey: "client-c", at: 200 },
        ],
      ),
    ).toEqual({
      joined: [{ userId: "user-3", clientKey: "client-c", at: 200 }],
      left: [{ userId: "user-1", clientKey: "client-a", at: 100 }],
    });
  });
});

describe("presence event buffer", () => {
  it("trims oldest cursor and typing events first", () => {
    const buffer = new PresenceEventBuffer(2);

    buffer.record({
      type: "cursor",
      userId: "user-1",
      clientKey: "client-a",
      cursorX: 1,
      cursorY: 1,
      at: 1,
    });
    buffer.record({
      type: "cursor",
      userId: "user-2",
      clientKey: "client-b",
      typing: true,
      at: 2,
    });
    buffer.record({
      type: "cursor",
      userId: "user-3",
      clientKey: "client-c",
      cursorX: 3,
      cursorY: 3,
      at: 3,
    });

    expect(buffer.events()).toEqual([
      {
        type: "cursor",
        userId: "user-2",
        clientKey: "client-b",
        typing: true,
        at: 2,
      },
      {
        type: "cursor",
        userId: "user-3",
        clientKey: "client-c",
        cursorX: 3,
        cursorY: 3,
        at: 3,
      },
    ]);
  });
});

describe("PresenceRoom", () => {
  it("authenticates before subscribing to a private presence room", async () => {
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
      track: vi.fn(async () => undefined),
      untrack: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      presenceState: vi.fn(() => ({})),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockImplementation((callback?: (status: string) => void) => {
      callback?.("SUBSCRIBED");
      return channel;
    });
    mocks.channel.mockReturnValue(channel);

    const room = new PresenceRoom({
      roomId: "board-1",
      userId: "user-1",
      accessToken: "access-token",
      clientKey: "client-1",
      now: () => 1_000,
    });

    await room.join();

    expect(mocks.setAuth).toHaveBeenCalledWith("access-token");
    expect(mocks.channel).toHaveBeenCalledWith("tidy:presence:board-1", {
      config: {
        private: true,
        presence: { key: "client-1" },
        broadcast: { self: false },
      },
    });
    expect(mocks.setAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.channel.mock.invocationCallOrder[0],
    );
    expect(channel.on).toHaveBeenCalledWith(
      "presence",
      { event: "sync" },
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "presence",
      { event: "join" },
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "presence",
      { event: "leave" },
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "broadcast",
      { event: "cursor" },
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalledOnce();
    expect(channel.track).toHaveBeenCalledWith({
      userId: "user-1",
      clientKey: "client-1",
      typing: false,
      at: 1_000,
    });

    room.leave();
    await vi.waitFor(() => {
      expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    });
  });

  it("untracks before removing the channel on leave", async () => {
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
      track: vi.fn(async () => undefined),
      untrack: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      presenceState: vi.fn(() => ({})),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    mocks.channel.mockReturnValue(channel);

    const room = new PresenceRoom({
      roomId: "board-1",
      userId: "user-1",
      accessToken: "access-token",
      clientKey: "client-1",
    });

    await room.join();
    room.leave();

    await vi.waitFor(() => {
      expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    });
    expect(channel.untrack).toHaveBeenCalledOnce();
    expect(channel.untrack.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeChannel.mock.invocationCallOrder[0],
    );
  });
});
