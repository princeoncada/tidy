import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  base64ToBytes,
  bytesToBase64,
} from "@/lib/collab/binary-base64";
import {
  createNoteDoc,
  encodeNoteState,
  getNoteText,
} from "@/lib/collab/yjs-note-doc";

const mocks = vi.hoisted(() => {
  const tx = {
    listItem: { findUnique: vi.fn() },
    itemNoteDoc: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return {
    tx,
    getUser: vi.fn(),
    getEffectiveListRole: vi.fn(),
    applyNotes: vi.fn(),
    transaction: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/sync/permissions", () => ({
  canRead: (role: string | null) => role !== null,
  canEditContent: (role: string | null) =>
    role === "EDITOR" || role === "OWNER",
  getEffectiveListRole: mocks.getEffectiveListRole,
}));

vi.mock("@/lib/sync/server-apply", () => ({
  applyCollaborativeListItemNotesWithinTransaction: mocks.applyNotes,
}));

vi.mock("@/lib/db", () => ({
  db: {
    listItem: { findUnique: mocks.tx.listItem.findUnique },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "@/app/api/collab/notes/[itemId]/route";

const itemId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ itemId }) };

function encodedNoteState(value: string): string {
  const doc = createNoteDoc();
  getNoteText(doc).insert(0, value);
  const state = bytesToBase64(encodeNoteState(doc));
  doc.destroy();
  return state;
}

function createPostRequest(value = "shared note") {
  return new Request(`http://tidy.test/api/collab/notes/${itemId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: encodedNoteState(value) }),
  });
}

describe("collaborative note route permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => unknown) =>
        callback(mocks.tx),
    );
    mocks.applyNotes.mockResolvedValue({
      operationId: `collab-note:${itemId}`,
      status: "applied",
      errorMessage: null,
    });
    mocks.tx.itemNoteDoc.upsert.mockResolvedValue({});
    mocks.tx.itemNoteDoc.findUnique.mockResolvedValue(null);
    mocks.tx.$queryRaw.mockResolvedValue([]);
    mocks.tx.$executeRaw.mockResolvedValue(1);
  });

  it("rejects GET when the user has no effective item access", async () => {
    mocks.tx.listItem.findUnique.mockResolvedValue({
      listId: "list-1",
      noteDoc: null,
    });
    mocks.getEffectiveListRole.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://tidy.test/api/collab/notes/${itemId}`),
      context,
    );

    expect(response.status).toBe(403);
  });

  it.each(["VIEWER", null])(
    "rejects POST for role %s",
    async (role) => {
      mocks.tx.listItem.findUnique.mockResolvedValue({ listId: "list-1" });
      mocks.getEffectiveListRole.mockResolvedValue(role);

      const response = await POST(createPostRequest(), context);

      expect(response.status).toBe(403);
      expect(mocks.applyNotes).not.toHaveBeenCalled();
      expect(mocks.tx.itemNoteDoc.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(["EDITOR", "OWNER"])(
    "accepts POST for role %s and persists the flattened note",
    async (role) => {
      mocks.tx.listItem.findUnique.mockResolvedValue({ listId: "list-1" });
      mocks.getEffectiveListRole.mockResolvedValue(role);

      const response = await POST(createPostRequest("flattened note"), context);

      expect(response.status).toBe(200);
      expect(mocks.applyNotes).toHaveBeenCalledWith({
        userId: "user-1",
        itemId,
        notes: "flattened note",
        tx: mocks.tx,
      });
      expect(mocks.tx.itemNoteDoc.upsert).toHaveBeenCalledWith({
        where: { itemId },
        update: { state: expect.any(Uint8Array) },
        create: { itemId, state: expect.any(Uint8Array) },
      });
      expect(mocks.tx.$executeRaw).toHaveBeenCalled();
      expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it("merges stored and incoming Yjs states before flattening", async () => {
    mocks.tx.listItem.findUnique.mockResolvedValue({ listId: "list-1" });
    mocks.getEffectiveListRole.mockResolvedValue("EDITOR");
    mocks.tx.itemNoteDoc.findUnique.mockResolvedValue({
      state: base64ToBytes(encodedNoteState("stored edit")),
    });

    const response = await POST(createPostRequest("incoming edit"), context);

    expect(response.status).toBe(200);
    const applied = mocks.applyNotes.mock.calls[0]?.[0];
    expect(applied.notes).toContain("stored edit");
    expect(applied.notes).toContain("incoming edit");
  });
});
