import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import {
  applyAcceptedSyncOperationsWithinTransaction,
  createSyncPostCommitEffects,
  runSyncPostCommitEffects,
  type SyncApplyOperationResult,
  type SyncPostCommitEffects,
} from "@/lib/sync/server-apply";
import {
  isReplicacheMutationName,
  translateReplicacheMutation,
  type ReplicacheMutationArgs,
} from "@/lib/sync/replicache/mutators";
import type { SyncBatchOperationDecision } from "@/lib/sync/sync-batch-contract";

export type ReplicachePushMutation = {
  id: number;
  clientID: string;
  name: string;
  args: unknown;
  timestamp: number;
};

export type ReplicachePushCorrection = {
  clientID: string;
  mutationID: number;
  messages: string[];
};

type TrackingClient = {
  id: string;
  clientGroupId: string;
  lastMutationID: number;
};

type ReplicacheTrackingTransaction = {
  replicacheClientGroup: {
    findUnique(args: unknown): Promise<{ id: string; userId: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
  replicacheClient: {
    findUnique(args: unknown): Promise<TrackingClient | null>;
    create(args: unknown): Promise<TrackingClient>;
    update(args: unknown): Promise<TrackingClient>;
  };
  listItem: {
    findUnique(args: unknown): Promise<{ listId: string } | null>;
  };
};

export type ReplicachePushDatabase = {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

type MutationTransactionResult =
  | { action: "skip" }
  | { action: "gap" }
  | {
      action: "applied";
      corrections: ReplicachePushCorrection[];
      effects: SyncPostCommitEffects;
      affectedListIds: string[];
    };

const REPLICACHE_MUTATION_SAVEPOINT = "replicache_mutation";

async function ensureTrackingClient({
  tx,
  userId,
  clientGroupID,
  clientID,
}: {
  tx: ReplicacheTrackingTransaction;
  userId: string;
  clientGroupID: string;
  clientID: string;
}) {
  const group = await tx.replicacheClientGroup.findUnique({
    where: { id: clientGroupID },
    select: { id: true, userId: true },
  });

  if (group && group.userId !== userId) {
    throw new Error("Replicache client group belongs to another user.");
  }
  if (!group) {
    await tx.replicacheClientGroup.create({
      data: { id: clientGroupID, userId },
    });
  }

  const client = await tx.replicacheClient.findUnique({
    where: { id: clientID },
  });
  if (client && client.clientGroupId !== clientGroupID) {
    throw new Error("Replicache client belongs to another client group.");
  }

  return client ?? tx.replicacheClient.create({
    data: {
      id: clientID,
      clientGroupId: clientGroupID,
      lastMutationID: 0,
    },
  });
}

function rejectedMessages(results: SyncApplyOperationResult[]) {
  return results.flatMap((result) =>
    result.status === "rejected"
      ? [result.errorMessage ?? "Server rejected the mutation."]
      : []
  );
}

async function getAffectedListIdsForMutation(
  tx: ReplicacheTrackingTransaction,
  mutation: ReplicachePushMutation,
): Promise<string[]> {
  if (typeof mutation.args !== "object" || mutation.args === null) return [];
  const args = mutation.args as Record<string, unknown>;
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) ids.add(value);
  };

  if (
    mutation.name === "createList" ||
    mutation.name === "renameList" ||
    mutation.name === "deleteList"
  ) {
    add(args.id);
  } else if (
    mutation.name === "reorderLists" ||
    mutation.name === "reorderViewLists"
  ) {
    add(args.listId);
  } else if (mutation.name === "moveItem") {
    add(args.fromListId);
    add(args.toListId);
  } else if (
    mutation.name === "createItem" ||
    mutation.name === "reorderItems"
  ) {
    add(args.listId);
  } else if (
    mutation.name === "updateItem" ||
    mutation.name === "deleteItem"
  ) {
    const item = typeof args.id === "string"
      ? await tx.listItem.findUnique({
          where: { id: args.id },
          select: { listId: true },
        })
      : null;
    add(item?.listId);
  }

  return [...ids];
}

export async function processReplicachePush({
  userId,
  clientGroupID,
  mutations,
  database = db as unknown as ReplicachePushDatabase,
  runEffects = async (effects) =>
    runSyncPostCommitEffects({ userId, effects }),
}: {
  userId: string;
  clientGroupID: string;
  mutations: ReplicachePushMutation[];
  database?: ReplicachePushDatabase;
  runEffects?: (effects: SyncPostCommitEffects) => Promise<void>;
}): Promise<{
  corrections: ReplicachePushCorrection[];
  applied: number;
  affectedListIds: string[];
}> {
  const corrections: ReplicachePushCorrection[] = [];
  const affectedListIds = new Set<string>();
  let applied = 0;

  for (const mutation of mutations) {
    const transactionResult = await database.$transaction(
      async (prismaTx): Promise<MutationTransactionResult> => {
        const tx = prismaTx as unknown as ReplicacheTrackingTransaction;
        const client = await ensureTrackingClient({
          tx,
          userId,
          clientGroupID,
          clientID: mutation.clientID,
        });

        if (mutation.id <= client.lastMutationID) {
          return { action: "skip" };
        }
        if (mutation.id > client.lastMutationID + 1) {
          return { action: "gap" };
        }

        let effects = createSyncPostCommitEffects();
        let mutationCorrections: ReplicachePushCorrection[] = [];
        let mutationAffectedListIds: string[] = [];

        if (!isReplicacheMutationName(mutation.name)) {
          mutationCorrections = [{
            clientID: mutation.clientID,
            mutationID: mutation.id,
            messages: [`Unknown Replicache mutator: ${mutation.name}.`],
          }];
        } else {
          const decisions = translateReplicacheMutation({
            userId,
            clientID: mutation.clientID,
            mutationID: mutation.id,
            name: mutation.name,
            args: mutation.args as ReplicacheMutationArgs[
              typeof mutation.name
            ],
            timestamp: mutation.timestamp,
          });
          const accepted = decisions.filter(
            (
              decision,
            ): decision is Extract<
              SyncBatchOperationDecision,
              { accepted: true }
            > => decision.accepted,
          );
          const validationMessages = decisions.flatMap((decision) =>
            decision.accepted ? [] : decision.errors
          );
          let applyMessages: string[] = [];

          if (validationMessages.length === 0 && accepted.length > 0) {
            mutationAffectedListIds = await getAffectedListIdsForMutation(
              tx,
              mutation,
            );
            await prismaTx.$executeRawUnsafe(
              `SAVEPOINT ${REPLICACHE_MUTATION_SAVEPOINT}`,
            );
            const results =
              await applyAcceptedSyncOperationsWithinTransaction({
                userId,
                decisions: accepted,
                tx: prismaTx,
                effects,
              });
            applyMessages = rejectedMessages(results);

            if (applyMessages.length > 0) {
              await prismaTx.$executeRawUnsafe(
                `ROLLBACK TO SAVEPOINT ${REPLICACHE_MUTATION_SAVEPOINT}`,
              );
              effects = createSyncPostCommitEffects();
              mutationAffectedListIds = [];
            }
            await prismaTx.$executeRawUnsafe(
              `RELEASE SAVEPOINT ${REPLICACHE_MUTATION_SAVEPOINT}`,
            );
          }

          const messages = [...validationMessages, ...applyMessages];
          if (messages.length > 0) {
            mutationCorrections = [{
              clientID: mutation.clientID,
              mutationID: mutation.id,
              messages,
            }];
          }
        }

        await tx.replicacheClient.update({
          where: { id: mutation.clientID },
          data: { lastMutationID: mutation.id },
        });

        return {
          action: "applied",
          corrections: mutationCorrections,
          effects,
          affectedListIds: mutationAffectedListIds,
        };
      },
    );

    if (transactionResult.action === "gap") {
      break;
    }
    if (transactionResult.action === "applied") {
      applied += 1;
      corrections.push(...transactionResult.corrections);
      transactionResult.affectedListIds.forEach((id) =>
        affectedListIds.add(id)
      );
      await runEffects(transactionResult.effects);
    }
  }

  return { corrections, applied, affectedListIds: [...affectedListIds] };
}
