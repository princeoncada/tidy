import { db } from "@/lib/db";
import { base64ToBytes, bytesToBase64 } from "@/lib/collab/binary-base64";
import {
  applyNoteUpdate,
  createNoteDoc,
  encodeNoteState,
  flattenNoteText,
} from "@/lib/collab/yjs-note-doc";
import { createClient } from "@/lib/supabase/server";
import {
  canEditContent,
  canRead,
  getEffectiveListRole,
} from "@/lib/sync/permissions";
import { applyCollaborativeListItemNotesWithinTransaction } from "@/lib/sync/server-apply";

const MAX_NOTE_DOC_BYTES = 256 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_NOTE_DOC_BYTES / 3) * 4 + 4;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function emptyNoteState(): string {
  const doc = createNoteDoc();
  const state = bytesToBase64(encodeNoteState(doc));
  doc.destroy();
  return state;
}

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await context.params;
  if (!UUID_PATTERN.test(itemId)) {
    return Response.json({ error: "Invalid item id." }, { status: 400 });
  }
  const item = await db.listItem.findUnique({
    where: { id: itemId },
    select: {
      listId: true,
      noteDoc: { select: { state: true } },
    },
  });
  if (!item) {
    return Response.json({ error: "Item not found." }, { status: 404 });
  }

  const role = await getEffectiveListRole(db, userId, item.listId);
  if (!canRead(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({
    state: item.noteDoc
      ? bytesToBase64(item.noteDoc.state)
      : emptyNoteState(),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await context.params;
  if (!UUID_PATTERN.test(itemId)) {
    return Response.json({ error: "Invalid item id." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BASE64_LENGTH + 64) {
    return Response.json(
      { error: "Collaborative note document is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).state !== "string"
  ) {
    return Response.json(
      { error: "Request body must include a base64 state string." },
      { status: 422 },
    );
  }

  const encodedState = (body as { state: string }).state;
  if (encodedState.length === 0 || encodedState.length > MAX_BASE64_LENGTH) {
    return Response.json(
      { error: "Collaborative note document is too large or empty." },
      { status: 413 },
    );
  }

  let state: Uint8Array;
  const doc = createNoteDoc();
  try {
    state = base64ToBytes(encodedState);
    if (state.length === 0 || state.length > MAX_NOTE_DOC_BYTES) {
      throw new Error("Invalid note document size.");
    }
    applyNoteUpdate(doc, state);
  } catch {
    doc.destroy();
    return Response.json(
      { error: "Collaborative note state is invalid." },
      { status: 422 },
    );
  }
  doc.destroy();

  const outcome = await db.$transaction(async (tx) => {
    const item = await tx.listItem.findUnique({
      where: { id: itemId },
      select: { listId: true },
    });
    if (!item) return { status: 404 as const, error: "Item not found." };

    const role = await getEffectiveListRole(tx, userId, item.listId);
    if (!canEditContent(role)) {
      return { status: 403 as const, error: "Forbidden" };
    }

    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${itemId}, 0))
    `;

    const current = await tx.itemNoteDoc.findUnique({
      where: { itemId },
      select: { state: true },
    });
    const mergedDoc = createNoteDoc();
    try {
      if (current) {
        applyNoteUpdate(mergedDoc, current.state);
      }
      applyNoteUpdate(mergedDoc, state);
      const mergedState = encodeNoteState(mergedDoc);
      const notes = flattenNoteText(mergedDoc);

      const applyResult =
        await applyCollaborativeListItemNotesWithinTransaction({
          userId,
          itemId,
          notes,
          tx,
        });
      if (applyResult.status === "rejected") {
        return {
          status: 409 as const,
          error: applyResult.errorMessage ?? "Note update was rejected.",
        };
      }

      await tx.itemNoteDoc.upsert({
        where: { itemId },
        update: { state: new Uint8Array(mergedState) },
        create: { itemId, state: new Uint8Array(mergedState) },
      });

      return { status: 200 as const, error: null };
    } finally {
      mergedDoc.destroy();
    }
  });

  if (outcome.status !== 200) {
    return Response.json(
      { error: outcome.error },
      { status: outcome.status },
    );
  }
  return Response.json({ ok: true }, { status: 200 });
}
