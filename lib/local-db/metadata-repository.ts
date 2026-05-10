import { createLocalTimestamp } from "./local-repositories";
import type { LocalDbMetadata } from "./local-schema";
import { TIDY_LOCAL_DB_NAME, tidyLocalDb } from "./tidy-db";

export const LOCAL_DB_SCHEMA_VERSION = "1";

export const LOCAL_DB_METADATA_KEYS = {
  initializedAt: "localDbInitializedAt",
  lastHealthCheckAt: "lastLocalDbHealthCheckAt",
  schemaVersion: "localDbSchemaVersion",
} as const;

export type LocalDbHealthSnapshot = {
  available: boolean;
  dbName: string;
  schemaVersion: string;
  initializedAt: string | null;
  lastHealthCheckAt: string | null;
  errorMessage: string | null;
};

type LocalMetadataDatabase = {
  metadata: {
    get(key: string): Promise<LocalDbMetadata | undefined>;
    put(metadata: LocalDbMetadata): Promise<string>;
  };
};

function unavailableSnapshot(errorMessage: string): LocalDbHealthSnapshot {
  return {
    available: false,
    dbName: TIDY_LOCAL_DB_NAME,
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    initializedAt: null,
    lastHealthCheckAt: null,
    errorMessage,
  };
}

export async function getLocalMetadata(
  key: string,
  db: LocalMetadataDatabase | null = tidyLocalDb,
): Promise<string | null> {
  if (!db) {
    return null;
  }

  const metadata = await db.metadata.get(key);
  return metadata?.value ?? null;
}

export async function setLocalMetadata(
  key: string,
  value: string,
  db: LocalMetadataDatabase | null = tidyLocalDb,
  updatedAt = createLocalTimestamp(),
): Promise<LocalDbMetadata | null> {
  if (!db) {
    return null;
  }

  const metadata: LocalDbMetadata = {
    key,
    value,
    updatedAt,
  };

  await db.metadata.put(metadata);
  return metadata;
}

export async function getLocalDbHealthSnapshot(
  db: LocalMetadataDatabase | null = tidyLocalDb,
): Promise<LocalDbHealthSnapshot> {
  if (!db) {
    return unavailableSnapshot("Tidy local database is only available in the browser.");
  }

  try {
    return {
      available: true,
      dbName: TIDY_LOCAL_DB_NAME,
      schemaVersion:
        (await getLocalMetadata(LOCAL_DB_METADATA_KEYS.schemaVersion, db)) ?? LOCAL_DB_SCHEMA_VERSION,
      initializedAt: await getLocalMetadata(LOCAL_DB_METADATA_KEYS.initializedAt, db),
      lastHealthCheckAt: await getLocalMetadata(LOCAL_DB_METADATA_KEYS.lastHealthCheckAt, db),
      errorMessage: null,
    };
  } catch (error) {
    return unavailableSnapshot(error instanceof Error ? error.message : "Unable to read Tidy local database.");
  }
}

export async function initializeLocalDbHealthMetadata(
  db: LocalMetadataDatabase | null = tidyLocalDb,
  checkedAt = createLocalTimestamp(),
): Promise<LocalDbHealthSnapshot> {
  if (!db) {
    return unavailableSnapshot("Tidy local database is only available in the browser.");
  }

  try {
    const initializedAt = await getLocalMetadata(LOCAL_DB_METADATA_KEYS.initializedAt, db);

    if (!initializedAt) {
      await setLocalMetadata(LOCAL_DB_METADATA_KEYS.initializedAt, checkedAt, db, checkedAt);
    }

    await setLocalMetadata(LOCAL_DB_METADATA_KEYS.schemaVersion, LOCAL_DB_SCHEMA_VERSION, db, checkedAt);
    await setLocalMetadata(LOCAL_DB_METADATA_KEYS.lastHealthCheckAt, checkedAt, db, checkedAt);

    return getLocalDbHealthSnapshot(db);
  } catch (error) {
    return unavailableSnapshot(error instanceof Error ? error.message : "Unable to initialize Tidy local database.");
  }
}
