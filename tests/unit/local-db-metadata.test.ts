import { describe, expect, it, vi } from "vitest";

import {
  getLocalDbHealthSnapshot,
  getLocalMetadata,
  initializeLocalDbHealthMetadata,
  LOCAL_DB_METADATA_KEYS,
  LOCAL_DB_SCHEMA_VERSION,
  setLocalMetadata,
} from "@/lib/local-db/metadata-repository";
import type { LocalDbMetadata } from "@/lib/local-db/local-schema";

const createMetadataDb = () => {
  const store = new Map<string, LocalDbMetadata>();

  return {
    store,
    db: {
      metadata: {
        get: vi.fn(async (key: string) => store.get(key)),
        put: vi.fn(async (metadata: LocalDbMetadata) => {
          store.set(metadata.key, metadata);
          return metadata.key;
        }),
      },
    },
  };
};

describe("local db metadata repository", () => {
  it("sets and gets a metadata value", async () => {
    const { db, store } = createMetadataDb();

    await expect(
      setLocalMetadata("localDbInitializedAt", "2026-05-10T10:00:00.000Z", db, "2026-05-10T10:01:00.000Z"),
    ).resolves.toEqual({
      key: "localDbInitializedAt",
      value: "2026-05-10T10:00:00.000Z",
      updatedAt: "2026-05-10T10:01:00.000Z",
    });

    await expect(getLocalMetadata("localDbInitializedAt", db)).resolves.toBe("2026-05-10T10:00:00.000Z");
    expect(store.get("localDbInitializedAt")?.updatedAt).toBe("2026-05-10T10:01:00.000Z");
  });

  it("returns null for missing metadata keys", async () => {
    const { db } = createMetadataDb();

    await expect(getLocalMetadata("missing", db)).resolves.toBeNull();
  });

  it("returns null without throwing when Dexie is unavailable", async () => {
    await expect(getLocalMetadata("localDbInitializedAt", null)).resolves.toBeNull();
    await expect(setLocalMetadata("localDbInitializedAt", "value", null)).resolves.toBeNull();
  });

  it("initializes local db health metadata without overwriting initializedAt", async () => {
    const { db, store } = createMetadataDb();

    store.set(LOCAL_DB_METADATA_KEYS.initializedAt, {
      key: LOCAL_DB_METADATA_KEYS.initializedAt,
      value: "2026-05-10T09:00:00.000Z",
      updatedAt: "2026-05-10T09:00:00.000Z",
    });

    await expect(initializeLocalDbHealthMetadata(db, "2026-05-10T10:00:00.000Z")).resolves.toEqual({
      available: true,
      dbName: "tidy-local-db",
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      initializedAt: "2026-05-10T09:00:00.000Z",
      lastHealthCheckAt: "2026-05-10T10:00:00.000Z",
      errorMessage: null,
    });
  });

  it("creates initializedAt during first health initialization", async () => {
    const { db } = createMetadataDb();

    await initializeLocalDbHealthMetadata(db, "2026-05-10T10:00:00.000Z");

    await expect(getLocalMetadata(LOCAL_DB_METADATA_KEYS.initializedAt, db)).resolves.toBe(
      "2026-05-10T10:00:00.000Z",
    );
    await expect(getLocalMetadata(LOCAL_DB_METADATA_KEYS.schemaVersion, db)).resolves.toBe(LOCAL_DB_SCHEMA_VERSION);
    await expect(getLocalMetadata(LOCAL_DB_METADATA_KEYS.lastHealthCheckAt, db)).resolves.toBe(
      "2026-05-10T10:00:00.000Z",
    );
  });

  it("reports an unavailable health snapshot without Dexie", async () => {
    await expect(getLocalDbHealthSnapshot(null)).resolves.toEqual({
      available: false,
      dbName: "tidy-local-db",
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      initializedAt: null,
      lastHealthCheckAt: null,
      errorMessage: "Tidy local database is only available in the browser.",
    });
  });

  it("reports metadata read failures as unavailable snapshots", async () => {
    const db = {
      metadata: {
        get: vi.fn(async () => {
          throw new Error("IndexedDB blocked");
        }),
        put: vi.fn(),
      },
    };

    await expect(getLocalDbHealthSnapshot(db)).resolves.toEqual({
      available: false,
      dbName: "tidy-local-db",
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      initializedAt: null,
      lastHealthCheckAt: null,
      errorMessage: "IndexedDB blocked",
    });
  });
});
