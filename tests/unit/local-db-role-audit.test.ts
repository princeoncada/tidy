import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  initializeLocalDbHealthMetadata,
  LOCAL_DB_METADATA_KEYS,
} from "@/lib/local-db/metadata-repository";
import type { LocalDbMetadata } from "@/lib/local-db/local-schema";
import { tidyLocalDb } from "@/lib/local-db/tidy-db";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("local db role audit (1.8.0 characterization)", () => {
  describe("runtime startup persists only health metadata, never dashboard entities", () => {
    it("writes exactly the three health-metadata keys", async () => {
      const store = new Map<string, LocalDbMetadata>();
      const db = {
        metadata: {
          get: vi.fn(async (key: string) => store.get(key)),
          put: vi.fn(async (metadata: LocalDbMetadata) => {
            store.set(metadata.key, metadata);
            return metadata.key;
          }),
        },
      };

      await initializeLocalDbHealthMetadata(db, "2026-06-05T10:00:00.000Z");

      expect([...store.keys()].sort()).toEqual(
        [
          LOCAL_DB_METADATA_KEYS.initializedAt,
          LOCAL_DB_METADATA_KEYS.lastHealthCheckAt,
          LOCAL_DB_METADATA_KEYS.schemaVersion,
        ].sort(),
      );
    });

    it("does not construct a Dexie instance in a non-browser runtime", () => {
      expect(tidyLocalDb).toBeNull();
    });
  });

  describe("dashboard write path does not depend on the local DB", () => {
    it("useOptimisticSync does not import lib/local-db", () => {
      expect(readSource("hooks/useOptimisticSync.ts")).not.toMatch(/local-db/);
    });

    it("dashboard cache does not import lib/local-db", () => {
      expect(readSource("lib/dashboard-cache.ts")).not.toMatch(/local-db/);
    });
  });

  describe("no sync worker or outbox replay is wired into runtime", () => {
    it("trpc client wires only the metadata health-check from local-db", () => {
      const client = readSource("trpc/client.tsx");
      expect(client).toMatch(/use-local-db-health-check/);
      expect(client).not.toMatch(/sync-replay-client/);
      expect(client).not.toMatch(/outbox-repository/);
    });
  });
});
