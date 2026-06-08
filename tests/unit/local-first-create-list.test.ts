import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isLocalFirstCreateListEnabled,
  readLocalFirstCreatedList,
  type LocalListRepositoryDatabase,
} from "@/lib/sync/local-first-create-list";
import type { LocalList } from "@/lib/local-db/local-schema";

function createFakeDb() {
  const store = new Map<string, LocalList>();
  const put = vi.fn(async (list: LocalList) => {
    store.set(list.clientId, list);
    return list.clientId;
  });
  const get = vi.fn(async (clientId: string) => store.get(clientId));
  const db: LocalListRepositoryDatabase = { lists: { put, get } };
  return { db, store, put, get };
}

const input = {
  clientId: "client-1",
  serverId: "server-1",
  userId: "user-1",
  name: "Groceries",
  createdAt: new Date("2026-06-08T00:00:00.000Z"),
  updatedAt: new Date("2026-06-08T00:00:00.000Z"),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("local-first create list bridge", () => {
  it("is disabled by default", () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED", "");
    expect(isLocalFirstCreateListEnabled()).toBe(false);
  });

  it("returns null and never writes when the flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED", "false");
    const { db, put } = createFakeDb();
    const result = await readLocalFirstCreatedList(input, { db });
    expect(result).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it("writes the local list and returns the read-back view when the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED", "true");
    const { db, store, put, get } = createFakeDb();
    const result = await readLocalFirstCreatedList(input, { db });
    expect(put).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("client-1");
    expect(store.get("client-1")).toMatchObject({
      clientId: "client-1",
      serverId: "server-1",
      userId: "user-1",
      name: "Groceries",
      syncStatus: "synced",
    });
    expect(result).toEqual({
      id: "server-1",
      userId: "user-1",
      name: "Groceries",
      createdAt: new Date("2026-06-08T00:00:00.000Z"),
      updatedAt: new Date("2026-06-08T00:00:00.000Z"),
    });
  });

  it("returns null when the local write fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED", "true");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db: LocalListRepositoryDatabase = {
      lists: {
        put: vi.fn(async () => {
          throw new Error("boom");
        }),
        get: vi.fn(async () => undefined),
      },
    };
    const result = await readLocalFirstCreatedList(input, { db });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});
