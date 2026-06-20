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
  vi.restoreAllMocks();
});

describe("realtime poke", () => {
  it("builds a stable per-user topic", () => {
    expect(pokeTopicForUser("u1")).toBe("tidy:user:u1");
  });

  it("posts a private broadcast poke authenticated with the service-role key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 202,
    }));

    const result = await pokeUser("u1", { fetchImpl });

    expect(result).toEqual({ delivered: true, status: 202 });
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
      private: true,
    });
  });

  it("surfaces a non-success broadcast response without throwing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 403,
    }));

    const result = await pokeUser("u1", { fetchImpl });

    expect(result).toEqual({
      delivered: false,
      reason: "rejected",
      status: 403,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("surfaces a thrown broadcast error without throwing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("network unavailable");
    });

    const result = await pokeUser("u1", { fetchImpl });

    expect(result).toEqual({
      delivered: false,
      reason: "error",
      error: "network unavailable",
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not send when the Supabase URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await pokeUser("u1", { fetchImpl });

    expect(result).toEqual({ delivered: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not send when the service-role key is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await pokeUser("u1", { fetchImpl });

    expect(result).toEqual({ delivered: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
