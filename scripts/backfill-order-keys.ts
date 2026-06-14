/**
 * Run once after applying the migration that adds nullable orderKey columns.
 */
import { Prisma, PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { initialKeys } from "../lib/sync/fractional-index";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

type OrderedRow = {
  id: string;
  groupId: string;
};

function groupRows(rows: OrderedRow[]) {
  const groups = new Map<string, OrderedRow[]>();

  for (const row of rows) {
    const group = groups.get(row.groupId) ?? [];
    group.push(row);
    groups.set(row.groupId, group);
  }

  return groups.values();
}

async function backfillViews() {
  const rows = await db.view.findMany({
    orderBy: [{ userId: "asc" }, { order: "asc" }, { id: "asc" }],
    select: { id: true, userId: true },
  });

  for (const group of groupRows(
    rows.map((row) => ({ id: row.id, groupId: row.userId })),
  )) {
    const keys = initialKeys(group.length);
    await db.$executeRaw(
      Prisma.sql`
        UPDATE "View" AS entity
        SET "orderKey" = data."orderKey"
        FROM (VALUES ${Prisma.join(
          group.map((row, index) =>
            Prisma.sql`(${row.id}::uuid, ${keys[index]})`
          ),
        )}) AS data("id", "orderKey")
        WHERE entity."id" = data."id"
      `,
    );
  }
}

async function backfillViewLists() {
  const rows = await db.viewList.findMany({
    orderBy: [{ viewId: "asc" }, { order: "asc" }, { listId: "asc" }],
    select: { viewId: true, listId: true },
  });

  const grouped = new Map<string, Array<{ viewId: string; listId: string }>>();
  for (const row of rows) {
    const group = grouped.get(row.viewId) ?? [];
    group.push(row);
    grouped.set(row.viewId, group);
  }

  for (const group of grouped.values()) {
    const keys = initialKeys(group.length);
    await db.$executeRaw(
      Prisma.sql`
        UPDATE "ViewList" AS entity
        SET "orderKey" = data."orderKey"
        FROM (VALUES ${Prisma.join(
          group.map((row, index) =>
            Prisma.sql`(${row.viewId}::uuid, ${row.listId}::uuid, ${keys[index]})`
          ),
        )}) AS data("viewId", "listId", "orderKey")
        WHERE entity."viewId" = data."viewId"
          AND entity."listId" = data."listId"
      `,
    );
  }
}

async function backfillListItems() {
  const rows = await db.listItem.findMany({
    orderBy: [{ listId: "asc" }, { order: "asc" }, { id: "asc" }],
    select: { id: true, listId: true },
  });

  for (const group of groupRows(
    rows.map((row) => ({ id: row.id, groupId: row.listId })),
  )) {
    const keys = initialKeys(group.length);
    await db.$executeRaw(
      Prisma.sql`
        UPDATE "ListItem" AS entity
        SET "orderKey" = data."orderKey"
        FROM (VALUES ${Prisma.join(
          group.map((row, index) =>
            Prisma.sql`(${row.id}::uuid, ${keys[index]})`
          ),
        )}) AS data("id", "orderKey")
        WHERE entity."id" = data."id"
      `,
    );
  }
}

async function main() {
  await backfillViews();
  await backfillViewLists();
  await backfillListItems();
}

main()
  .catch((error) => {
    console.error("Order-key backfill failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
