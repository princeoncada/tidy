import { describe, expect, it } from "vitest";

import {
  assertLocalDbAvailable,
  EXPECTED_LOCAL_DB_STORE_NAMES,
  getLocalDbSchemaSummary,
  getLocalDbStoreNames,
} from "@/lib/local-db/local-db-diagnostics";
import { LOCAL_DB_SCHEMA_VERSION } from "@/lib/local-db/metadata-repository";

const dbWithStores = (storeNames: string[]) => ({
  tables: storeNames.map((name) => ({ name })),
});

describe("local db diagnostics", () => {
  it("reports expected store names in sorted order", () => {
    expect(getLocalDbStoreNames(dbWithStores(["metadata", "lists", "views"]))).toEqual([
      "lists",
      "metadata",
      "views",
    ]);
  });

  it("returns an empty store list when Dexie is unavailable", () => {
    expect(getLocalDbStoreNames(null)).toEqual([]);
  });

  it("reports a complete schema summary when expected stores exist", () => {
    expect(getLocalDbSchemaSummary(dbWithStores([...EXPECTED_LOCAL_DB_STORE_NAMES]))).toEqual({
      available: true,
      dbName: "tidy-local-db",
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      storeNames: [...EXPECTED_LOCAL_DB_STORE_NAMES].sort(),
      expectedStoreNames: EXPECTED_LOCAL_DB_STORE_NAMES,
      missingExpectedStores: [],
      errorMessage: null,
    });
  });

  it("reports missing expected stores", () => {
    expect(getLocalDbSchemaSummary(dbWithStores(["metadata", "lists"]))).toMatchObject({
      available: true,
      missingExpectedStores: [
        "views",
        "listItems",
        "tags",
        "viewTags",
        "listTags",
        "viewLists",
        "outboxOperations",
      ],
    });
  });

  it("reports a safe unavailable schema summary without Dexie", () => {
    expect(getLocalDbSchemaSummary(null)).toEqual({
      available: false,
      dbName: "tidy-local-db",
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      storeNames: [],
      expectedStoreNames: EXPECTED_LOCAL_DB_STORE_NAMES,
      missingExpectedStores: [...EXPECTED_LOCAL_DB_STORE_NAMES],
      errorMessage: "Tidy local database is only available in the browser.",
    });
  });

  it("throws a clear error when asserting unavailable Dexie", () => {
    expect(() => assertLocalDbAvailable(null)).toThrow(
      "Tidy local database is only available in the browser.",
    );
  });

  it("does not throw when asserting available Dexie", () => {
    expect(() => assertLocalDbAvailable(dbWithStores(["metadata"]))).not.toThrow();
  });
});
