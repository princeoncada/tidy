import {
  getLocalDbHealthSnapshot,
  LOCAL_DB_SCHEMA_VERSION,
  type LocalDbHealthSnapshot,
} from "./metadata-repository";
import { TIDY_LOCAL_DB_NAME, tidyLocalDb } from "./tidy-db";

export const EXPECTED_LOCAL_DB_STORE_NAMES = [
  "views",
  "lists",
  "listItems",
  "tags",
  "viewTags",
  "listTags",
  "viewLists",
  "outboxOperations",
  "metadata",
] as const;

export type LocalDbStoreName = (typeof EXPECTED_LOCAL_DB_STORE_NAMES)[number];

export type LocalDbDiagnosticsDatabase = {
  tables: Array<{ name: string }>;
};

export type LocalDbSchemaSummary = {
  available: boolean;
  dbName: string;
  schemaVersion: string;
  storeNames: string[];
  expectedStoreNames: readonly LocalDbStoreName[];
  missingExpectedStores: LocalDbStoreName[];
  errorMessage: string | null;
};

function unavailableSchemaSummary(errorMessage: string): LocalDbSchemaSummary {
  return {
    available: false,
    dbName: TIDY_LOCAL_DB_NAME,
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    storeNames: [],
    expectedStoreNames: EXPECTED_LOCAL_DB_STORE_NAMES,
    missingExpectedStores: [...EXPECTED_LOCAL_DB_STORE_NAMES],
    errorMessage,
  };
}

export function getLocalDbStoreNames(
  db: LocalDbDiagnosticsDatabase | null = tidyLocalDb,
): string[] {
  if (!db) {
    return [];
  }

  return db.tables.map((table) => table.name).sort();
}

export function getLocalDbSchemaSummary(
  db: LocalDbDiagnosticsDatabase | null = tidyLocalDb,
): LocalDbSchemaSummary {
  if (!db) {
    return unavailableSchemaSummary("Tidy local database is only available in the browser.");
  }

  try {
    const storeNames = getLocalDbStoreNames(db);
    const missingExpectedStores = EXPECTED_LOCAL_DB_STORE_NAMES.filter(
      (storeName) => !storeNames.includes(storeName),
    );

    return {
      available: true,
      dbName: TIDY_LOCAL_DB_NAME,
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      storeNames,
      expectedStoreNames: EXPECTED_LOCAL_DB_STORE_NAMES,
      missingExpectedStores,
      errorMessage: null,
    };
  } catch (error) {
    return unavailableSchemaSummary(error instanceof Error ? error.message : "Unable to inspect Tidy local database.");
  }
}

export function assertLocalDbAvailable(
  db: LocalDbDiagnosticsDatabase | null = tidyLocalDb,
): asserts db is LocalDbDiagnosticsDatabase {
  if (!db) {
    throw new Error("Tidy local database is only available in the browser.");
  }
}

export async function readLocalDbHealthForDiagnostics(): Promise<{
  health: LocalDbHealthSnapshot;
  schema: LocalDbSchemaSummary;
}> {
  return {
    health: await getLocalDbHealthSnapshot(),
    schema: getLocalDbSchemaSummary(),
  };
}
