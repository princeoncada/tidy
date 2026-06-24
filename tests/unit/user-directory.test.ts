import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveUserLabels } from "@/lib/sharing/user-directory";

const USER_ONE = "11111111-1111-4111-8111-111111111111";
const USER_TWO = "22222222-2222-4222-8222-222222222222";

function configureSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://tidy.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
}

describe("resolveUserLabels", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses email from the GoTrue admin user response", async () => {
    configureSupabaseEnv();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ email: "owner@example.com" }), {
        status: 200,
      }),
    );

    const labels = await resolveUserLabels([USER_ONE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(labels.get(USER_ONE)).toBe("owner@example.com");
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://tidy.supabase.co/auth/v1/admin/users/${USER_ONE}`,
      {
        headers: {
          apikey: "service-role-key",
          authorization: "Bearer service-role-key",
        },
      },
    );
  });

  it("prefers full_name metadata over email", async () => {
    configureSupabaseEnv();
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          email: "owner@example.com",
          user_metadata: { full_name: "Tidy Owner" },
        }),
        { status: 200 },
      ),
    );

    const labels = await resolveUserLabels([USER_ONE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(labels.get(USER_ONE)).toBe("Tidy Owner");
  });

  it("returns id-based fallbacks and skips fetch when Supabase admin env is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    const fetchImpl = vi.fn();

    const labels = await resolveUserLabels([USER_ONE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(labels.get(USER_ONE)).toBe("User 11111111");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps fallback labels when fetch rejects or returns non-ok", async () => {
    configureSupabaseEnv();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockRejectedValueOnce(new Error("network down"));

    const labels = await resolveUserLabels([USER_ONE, USER_TWO], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(labels.get(USER_ONE)).toBe("User 11111111");
    expect(labels.get(USER_TWO)).toBe("User 22222222");
  });

  it("dedupes repeated ids before lookup", async () => {
    configureSupabaseEnv();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ email: "owner@example.com" }), {
        status: 200,
      }),
    );

    const labels = await resolveUserLabels([USER_ONE, USER_ONE], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(labels.size).toBe(1);
    expect(labels.get(USER_ONE)).toBe("owner@example.com");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
