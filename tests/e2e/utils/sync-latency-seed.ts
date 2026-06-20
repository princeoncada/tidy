import { createClient } from "@supabase/supabase-js";

import { uniqueTestName } from "./seed";

const USERS_PER_PAGE = 1_000;

export async function resolveUserIdByEmail(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Sync-latency seeding requires NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) {
      throw new Error(
        `Could not list Supabase auth users for sync-latency seeding: ${error.message}`,
      );
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (match) return match.id;
    if (data.users.length < USERS_PER_PAGE) break;
  }

  throw new Error(
    `No Supabase auth user found for ${email}. Run npm run test:e2e:auth:setup ` +
    "with the same E2E_TEST_EMAIL_1/E2E_TEST_EMAIL_2 credentials.",
  );
}

export async function seedSharedList({
  ownerEmail,
  editorEmail,
  listCount,
  itemsPerWorkspace,
}: {
  ownerEmail: string;
  editorEmail: string;
  listCount: number;
  itemsPerWorkspace: number;
}) {
  if (!Number.isInteger(listCount) || listCount < 1) {
    throw new Error("Sync-latency listCount must be a positive integer.");
  }
  if (!Number.isInteger(itemsPerWorkspace) || itemsPerWorkspace < 0) {
    throw new Error(
      "Sync-latency itemsPerWorkspace must be a non-negative integer.",
    );
  }

  const [ownerId, editorId] = await Promise.all([
    resolveUserIdByEmail(ownerEmail),
    resolveUserIdByEmail(editorEmail),
  ]);
  if (ownerId === editorId) {
    throw new Error("Sync-latency owner and editor must be different users.");
  }

  const listName = uniqueTestName("latency");
  const { db } = await import("@/lib/db");
  try {
    const seeded = await db.$transaction(
      async (tx) => {
        const primaryList = await tx.list.create({
          data: {
            name: listName,
            userId: ownerId,
            listShares: {
              create: { userId: editorId, role: "EDITOR" },
            },
          },
        });
        const seededListIds = [primaryList.id];

        for (let index = 1; index < listCount; index += 1) {
          const extraList = await tx.list.create({
            data: {
              name: `${listName}-extra-${String(index).padStart(2, "0")}`,
              userId: ownerId,
            },
          });
          seededListIds.push(extraList.id);
        }

        if (itemsPerWorkspace > 0) {
          await tx.listItem.createMany({
            data: Array.from({ length: itemsPerWorkspace }, (_, index) => ({
              name: `${listName}-item-${String(index + 1).padStart(3, "0")}`,
              listId: seededListIds[index % seededListIds.length],
              order: Math.floor(index / seededListIds.length),
            })),
          });
        }

        return { primaryList, seededListIds };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    return {
      listId: seeded.primaryList.id,
      listName,
      ownerId,
      editorId,
      seededListIds: seeded.seededListIds,
    };
  } finally {
    await db.$disconnect();
  }
}

export async function cleanupSharedList(seededListIds: ReadonlyArray<string>) {
  const { db } = await import("@/lib/db");
  try {
    await db.list.deleteMany({ where: { id: { in: [...seededListIds] } } });
  } finally {
    await db.$disconnect();
  }
}
