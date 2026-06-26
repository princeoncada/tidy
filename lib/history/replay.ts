import type { ReadonlyJSONValue, WriteTransaction } from "replicache";

import {
  isReplicacheMutationName,
  replicacheMutators,
  type ReplicacheMutationArgs,
  type ReplicacheMutationName,
} from "@/lib/sync/replicache/mutators";

export type ReplayLedgerEntry = {
  name: string;
  args: unknown;
};

type ScanOptions = {
  prefix?: string;
};

function createReplayTransaction(store: Map<string, ReadonlyJSONValue>) {
  return {
    get: async <T extends ReadonlyJSONValue = ReadonlyJSONValue>(
      key: string,
    ) => store.get(key) as T | undefined,
    has: async (key: string) => store.has(key),
    set: async (key: string, value: ReadonlyJSONValue) => {
      store.set(key, value);
    },
    del: async (key: string) => {
      store.delete(key);
    },
    scan: ({ prefix = "" }: ScanOptions = {}) => {
      const matchingEntries = () =>
        [...store.entries()].filter(([key]) => key.startsWith(prefix));

      return {
        entries: () => ({
          toArray: async () => matchingEntries(),
        }),
        values: () => ({
          toArray: async () =>
            matchingEntries().map(([, value]) => value),
        }),
      };
    },
  } as unknown as WriteTransaction;
}

export async function replayMutationLedgerEntries(
  entries: readonly ReplayLedgerEntry[],
): Promise<Record<string, ReadonlyJSONValue>> {
  const store = new Map<string, ReadonlyJSONValue>();
  const tx = createReplayTransaction(store);

  for (const entry of entries) {
    if (!isReplicacheMutationName(entry.name)) {
      continue;
    }

    const mutator = replicacheMutators[
      entry.name as ReplicacheMutationName
    ] as (tx: WriteTransaction, args: unknown) => Promise<void>;
    await mutator(
      tx,
      entry.args as ReplicacheMutationArgs[ReplicacheMutationName],
    );
  }

  return Object.fromEntries([...store.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  ));
}
