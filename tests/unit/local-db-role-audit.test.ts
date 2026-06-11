import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  initializeLocalDbHealthMetadata,
  LOCAL_DB_METADATA_KEYS,
} from "@/lib/local-db/metadata-repository";
import type { LocalDbMetadata } from "@/lib/local-db/local-schema";

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

    it("gates Dexie construction on a browser window (null when window is undefined)", () => {
      expect(readSource("lib/local-db/tidy-db.ts")).toMatch(
        /typeof window === "undefined"\s*\?\s*null/,
      );
    });
  });

  describe("dashboard write path reads the local DB only for the sanctioned create-list slice", () => {
    it("imports the create-list local read-back from local-repositories", () => {
      expect(readSource("lib/dashboard-cache.ts")).toMatch(
        /from "@\/lib\/local-db\/local-repositories"/,
      );
    });

    it("does not couple to outbox, replay, sync worker, metadata, or direct Dexie construction", () => {
      const source = readSource("lib/dashboard-cache.ts");
      expect(source).not.toMatch(/outbox/);
      expect(source).not.toMatch(/sync-replay/);
      expect(source).not.toMatch(/metadata-repository/);
      expect(source).not.toMatch(/tidy-db/);
    });
  });

  describe("local-first dashboard reads stay in the boot and reconciliation surfaces", () => {
    it("boot hook reads local repositories without coupling to outbox, replay, or metadata", () => {
      const source = readSource("hooks/useLocalFirstDashboardBoot.ts");
      expect(source).toMatch(/@\/lib\/local-db\/local-repositories/);
      expect(source).not.toMatch(/outbox/);
      expect(source).not.toMatch(/sync-replay/);
      expect(source).not.toMatch(/metadata-repository/);
    });

    it("local-first dashboard mappers use local schema only, not Dexie or replay plumbing", () => {
      const source = readSource("lib/local-first-dashboard.ts");
      expect(source).toMatch(/@\/lib\/local-db\/local-schema/);
      expect(source).not.toMatch(/outbox/);
      expect(source).not.toMatch(/sync-replay/);
      expect(source).not.toMatch(/metadata-repository/);
      expect(source).not.toMatch(/tidy-db/);
    });

    it("ListsContainer seeds through repositories and routes movement through sanctioned helpers", () => {
      const source = readSource("components/list/ListsContainer.tsx");
      expect(source).toMatch(/@\/lib\/local-db\/local-repositories/);
      expect(source).toMatch(/@\/lib\/local-db\/local-write/);
      expect(source).toMatch(/@\/lib\/local-db\/local-movement/);
      expect(source).toMatch(/@\/lib\/local-db\/local-movement-repository/);
      expect(source).toMatch(/@\/lib\/local-first-reconcile/);
      expect(source).not.toMatch(/outbox/);
      expect(source).not.toMatch(/sync-replay/);
      expect(source).not.toMatch(/metadata-repository/);
      expect(source).not.toMatch(/tidy-db/);
    });

    it("the reconcile planner stays pure and Dexie-free", () => {
      const source = readSource("lib/local-first-reconcile.ts");
      expect(source).toMatch(/@\/lib\/local-first-dashboard/);
      expect(source).toMatch(/@\/lib\/local-db\/local-schema/);
      expect(source).not.toMatch(/dexie/i);
      expect(source).not.toMatch(/tidy-db/);
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
