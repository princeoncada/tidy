import {
  createLocalEntityBase,
  getLocalDbOrThrow,
} from "@/lib/local-db/local-repositories";
import type { LocalList } from "@/lib/local-db/local-schema";

export type LocalListRepositoryDatabase = {
  lists: {
    put(list: LocalList): Promise<string>;
    get(clientId: string): Promise<LocalList | undefined>;
  };
};

export type LocalFirstCreateListInput = {
  clientId: string;
  serverId: string;
  userId: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LocalFirstCreatedListView = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export function isLocalFirstCreateListEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_FIRST_CREATE_LIST_ENABLED === "true";
}

function getLocalListDb(
  db?: LocalListRepositoryDatabase,
): LocalListRepositoryDatabase {
  return db ?? (getLocalDbOrThrow() as unknown as LocalListRepositoryDatabase);
}

function toIso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export async function readLocalFirstCreatedList(
  input: LocalFirstCreateListInput,
  options: { db?: LocalListRepositoryDatabase } = {},
): Promise<LocalFirstCreatedListView | null> {
  if (!isLocalFirstCreateListEnabled()) {
    return null;
  }

  try {
    const db = getLocalListDb(options.db);
    const createdAt = toIso(input.createdAt);
    const updatedAt = toIso(input.updatedAt);
    const localList: LocalList = {
      ...createLocalEntityBase({
        clientId: input.clientId,
        serverId: input.serverId,
        userId: input.userId,
        syncStatus: "synced",
        createdAt,
        updatedAt,
        lastSyncedAt: updatedAt,
      }),
      name: input.name,
    };

    await db.lists.put(localList);
    const stored = await db.lists.get(input.clientId);
    if (!stored) {
      return null;
    }

    return {
      id: stored.serverId ?? stored.clientId,
      userId: stored.userId,
      name: stored.name,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    };
  } catch (error) {
    console.error("Failed to read local-first created list", error);
    return null;
  }
}
