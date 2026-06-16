import { afterEach, describe, expect, it, vi } from "vitest";

import { pokeUser } from "@/lib/realtime/poke-server";
import { pokeTopicForUser } from "@/lib/realtime/poke-topic";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }
  if (originalServiceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }
});

describe("realtime poke", () => {
  it("builds a stable per-user topic", () => {
    expect(pokeTopicForUser("u1")).toBe("tidy:user:u1");
  });

  it("posts a broadcast poke authenticated with the service-role key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 200,
    }));

    await pokeUser("u1", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/realtime/v1/api/broadcast",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.authorization).toBe("Bearer service-role-key");
    const body = JSON.parse(String(init?.body));
    expect(body.messages[0]).toMatchObject({
      topic: "tidy:user:u1",
      event: "poke",
    });
  });

  it("does not throw when the broadcast request fails", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("network unavailable");
    });

    await expect(pokeUser("u1", { fetchImpl })).resolves.toBeUndefined();
  });

  it("does not send when the Supabase URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const fetchImpl = vi.fn<typeof fetch>();

    await pokeUser("u1", { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not send when the service-role key is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchImpl = vi.fn<typeof fetch>();

    await pokeUser("u1", { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
