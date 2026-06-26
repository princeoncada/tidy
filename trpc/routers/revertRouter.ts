import { TRPCError } from "@trpc/server";
import z from "zod";

import {
  readReplicacheAccessibleListsForUser,
  readReplicacheAllListsSnapshotForUser,
  readReplicacheViewsForUser,
  readTagsForUser,
} from "@/lib/dashboard/server-read";
import { db } from "@/lib/db";
import { replayMutationLedgerEntries } from "@/lib/history/replay";
import { buildRevertPlan } from "@/lib/history/revert-plan";
import { pokeUser } from "@/lib/realtime/poke-server";
import { getUsersWithListAccess } from "@/lib/sync/permissions";
import { initialKeys, keyBetween } from "@/lib/sync/fractional-index";
import {
  REPLICACHE_KEY_PREFIXES,
  type ReplicacheListItemValue,
} from "@/lib/sync/replicache/keys";
import { buildReplicacheClientView } from "@/lib/sync/replicache/pull-cvr";
import {
  applyAcceptedSyncOperationsWithinTransaction,
  createSyncPostCommitEffects,
  runSyncPostCommitEffects,
} from "@/lib/sync/server-apply";
import { createTRPCRouter, protectedProcedure } from "../init";

type OrderedLedgerEntry = {
  id: string;
  clientId: string;
  mutationId: number;
  name: string;
  args: unknown;
  createdAt: Date;
};

function compareLedgerEntries(
  left: Pick<OrderedLedgerEntry, "createdAt" | "mutationId" | "clientId">,
  right: Pick<OrderedLedgerEntry, "createdAt" | "mutationId" | "clientId">,
): number {
  return left.createdAt.getTime() - right.createdAt.getTime() ||
    left.mutationId - right.mutationId ||
    left.clientId.localeCompare(right.clientId);
}

function differs(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

async function readCurrentReplicacheView(userId: string) {
  const [views, allLists, accessibleLists, tags] = await Promise.all([
    readReplicacheViewsForUser(userId),
    readReplicacheAllListsSnapshotForUser(userId),
    readReplicacheAccessibleListsForUser(userId),
    readTagsForUser(userId),
  ]);
  if (!allLists) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to build the owned dashboard view.",
    });
  }

  const allListsView = views.find((view) => view.type === "ALL_LISTS");
  const ownedFallbackKeys = initialKeys(allListsView?.viewLists.length ?? 0);
  const ownedOrderKeys = (allListsView?.viewLists ?? []).map(
    (membership, index) => membership.orderKey ?? ownedFallbackKeys[index],
  );
  let trailingOrderKey = ownedOrderKeys.reduce<string | null>(
    (largest, key) => !largest || key > largest ? key : largest,
    null,
  );
  const sharedMemberships = accessibleLists.map((list, index) => {
    trailingOrderKey = keyBetween(trailingOrderKey, null);
    return {
      listId: list.id,
      order: (allListsView?.viewLists.length ?? 0) + index,
      orderKey: trailingOrderKey,
    };
  });

  return buildReplicacheClientView({
    views: views.map((view) =>
      view.type === "ALL_LISTS"
        ? { ...view, viewLists: [...view.viewLists, ...sharedMemberships] }
        : view
    ),
    allLists: {
      ...allLists,
      lists: [
        ...allLists.lists.map((list) => ({
          ...list,
          accessRole: "OWNER" as const,
        })),
        ...accessibleLists,
      ],
    },
    tags,
  });
}

function affectedListIdsFromKeys({
  keys,
  current,
  target,
  fullReplay,
}: {
  keys: ReadonlySet<string>;
  current: Awaited<ReturnType<typeof readCurrentReplicacheView>>;
  target: Record<string, unknown>;
  fullReplay: Record<string, unknown>;
}): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) ids.add(value);
  };
  const addItemListId = (value: unknown) => {
    const item = value as Partial<ReplicacheListItemValue> | undefined;
    add(item?.listId);
  };

  for (const key of keys) {
    if (key.startsWith(REPLICACHE_KEY_PREFIXES.list)) {
      add(key.slice(REPLICACHE_KEY_PREFIXES.list.length));
      continue;
    }
    if (key.startsWith(REPLICACHE_KEY_PREFIXES.listItem)) {
      addItemListId(target[key]);
      addItemListId(fullReplay[key]);
      addItemListId(current[key]?.value);
      continue;
    }
    if (key.startsWith(REPLICACHE_KEY_PREFIXES.viewList)) {
      const parts = key.slice(REPLICACHE_KEY_PREFIXES.viewList.length).split("/");
      add(parts[1]);
      continue;
    }
    if (key.startsWith(REPLICACHE_KEY_PREFIXES.listTag)) {
      const parts = key.slice(REPLICACHE_KEY_PREFIXES.listTag.length).split("/");
      add(parts[0]);
    }
  }

  return [...ids];
}

export const revertRouter = createTRPCRouter({
  revertToLedgerEntry: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx: { userId }, input }) => {
      const targetEntry = await db.mutationLedgerEntry.findFirst({
        where: { id: input.entryId, userId },
        select: {
          id: true,
          clientId: true,
          mutationId: true,
          name: true,
          args: true,
          createdAt: true,
        },
      });
      if (!targetEntry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "History entry not found.",
        });
      }

      const entries = await db.mutationLedgerEntry.findMany({
        where: { userId },
        orderBy: [
          { createdAt: "asc" },
          { mutationId: "asc" },
          { clientId: "asc" },
        ],
        select: {
          id: true,
          clientId: true,
          mutationId: true,
          name: true,
          args: true,
          createdAt: true,
        },
      }) as OrderedLedgerEntry[];
      const targetOrder = {
        createdAt: targetEntry.createdAt,
        mutationId: targetEntry.mutationId,
        clientId: targetEntry.clientId,
      };
      const entriesUpToTarget = entries.filter(
        (entry) => compareLedgerEntries(entry, targetOrder) <= 0,
      );
      const [targetState, fullReplayState] = await Promise.all([
        replayMutationLedgerEntries(entriesUpToTarget),
        replayMutationLedgerEntries(entries),
      ]);
      const affectedKeys = new Set(
        [...new Set([
          ...Object.keys(targetState),
          ...Object.keys(fullReplayState),
        ])].filter((key) => differs(targetState[key], fullReplayState[key])),
      );

      const current = await readCurrentReplicacheView(userId);
      const plan = buildRevertPlan({
        current,
        target: targetState,
        affectedKeys,
      });

      if (plan.length === 0) {
        return { applied: 0 };
      }

      const affectedListIds = affectedListIdsFromKeys({
        keys: affectedKeys,
        current,
        target: targetState,
        fullReplay: fullReplayState,
      });
      const { effects } = await db.$transaction(async (tx) => {
        const effects = createSyncPostCommitEffects();
        const results = await applyAcceptedSyncOperationsWithinTransaction({
          userId,
          decisions: plan,
          tx,
          effects,
        });
        const rejected = results.find((result) => result.status === "rejected");
        if (rejected) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: rejected.errorMessage ?? "Revert operation was rejected.",
          });
        }
        return { effects };
      });

      await runSyncPostCommitEffects({ userId, effects });
      if (affectedListIds.length > 0) {
        const recipients = await getUsersWithListAccess(db, affectedListIds);
        recipients.add(userId);
        await Promise.all([...recipients].map((id) => pokeUser(id)));
      } else {
        await pokeUser(userId);
      }

      return { applied: plan.length };
    }),
});
