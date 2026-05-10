import Dexie, { type Table } from "dexie";

export const TIDY_LOCAL_DB_NAME = "tidy-local-db";

export type LocalDbMetadata = {
  key: string;
  value: string;
  updatedAt: string;
};

class TidyLocalDb extends Dexie {
  metadata!: Table<LocalDbMetadata, string>;

  constructor() {
    super(TIDY_LOCAL_DB_NAME);

    // Foundation-only store. Future checkpoints will add real local entity tables.
    this.version(1).stores({
      metadata: "key",
    });
  }
}

export type TidyLocalDatabase = TidyLocalDb;

export const tidyLocalDb: TidyLocalDatabase | null =
  typeof window === "undefined" ? null : new TidyLocalDb();
