import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAuth: vi.fn(async () => undefined),
  channel: vi.fn(),
  removeChannel: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    realtime: { setAuth: mocks.setAuth },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

import { subscribeToPokes } from "@/lib/realtime/poke-client";

describe("private realtime poke subscription", () => {
  it("authenticates before subscribing to a private per-user channel", async () => {
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    mocks.channel.mockReturnValue(channel);

    const cleanup = await subscribeToPokes({
      userId: "user-1",
      accessToken: "access-token",
      onPoke: vi.fn(),
    });

    expect(mocks.setAuth).toHaveBeenCalledWith("access-token");
    expect(mocks.channel).toHaveBeenCalledWith("tidy:user:user-1", {
      config: {
        private: true,
        broadcast: { self: false },
      },
    });
    expect(channel.subscribe).toHaveBeenCalledOnce();

    cleanup();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });
});
