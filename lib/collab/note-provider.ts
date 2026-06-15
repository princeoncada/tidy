"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type * as Y from "yjs";

import { base64ToBytes, bytesToBase64 } from "@/lib/collab/binary-base64";
import { noteTopicForItem } from "@/lib/collab/note-topic";
import {
  applyNoteUpdate,
  encodeNoteState,
} from "@/lib/collab/yjs-note-doc";
import { createClient } from "@/lib/supabase/client";

const REMOTE_UPDATE_ORIGIN = Symbol("remote-note-update");
const DEFAULT_PERSIST_DEBOUNCE_MS = 750;

type BroadcastPayload = {
  senderId: string;
  state: string;
};

export type NoteProviderTeardown = (() => Promise<void>) & {
  flush: () => Promise<void>;
};

function parseBroadcastPayload(value: unknown): BroadcastPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const envelope = value as Record<string, unknown>;
  const payload = envelope.payload;
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.senderId === "string" &&
    typeof record.state === "string"
    ? { senderId: record.senderId, state: record.state }
    : null;
}

async function loadInitialState({
  itemId,
  doc,
  fetchImpl,
}: {
  itemId: string;
  doc: Y.Doc;
  fetchImpl: typeof fetch;
}) {
  const response = await fetchImpl(
    `/api/collab/notes/${encodeURIComponent(itemId)}`,
    { credentials: "same-origin" },
  );
  if (!response.ok) {
    throw new Error(`Unable to load collaborative note (${response.status}).`);
  }
  const body = await response.json() as { state?: unknown };
  if (typeof body.state !== "string") {
    throw new Error("Collaborative note response is invalid.");
  }
  applyNoteUpdate(doc, base64ToBytes(body.state), REMOTE_UPDATE_ORIGIN);
}

export async function connectNoteProvider({
  itemId,
  doc,
  accessToken,
  userId,
  canEdit = true,
  fetchImpl = fetch,
  persistDebounceMs = DEFAULT_PERSIST_DEBOUNCE_MS,
}: {
  itemId: string;
  doc: Y.Doc;
  accessToken: string;
  userId: string;
  canEdit?: boolean;
  fetchImpl?: typeof fetch;
  persistDebounceMs?: number;
}): Promise<NoteProviderTeardown> {
  const client = createClient();
  await client.realtime.setAuth(accessToken);

  let destroyed = false;
  let subscribed = false;
  let dirty = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let persistQueue: Promise<void> = Promise.resolve();

  const endpoint = `/api/collab/notes/${encodeURIComponent(itemId)}`;
  let channel: RealtimeChannel;

  const broadcastState = (state: Uint8Array) => {
    if (!subscribed || destroyed || !canEdit) return;
    void channel.send({
      type: "broadcast",
      event: "yjs-update",
      payload: {
        senderId: userId,
        state: bytesToBase64(state),
      },
    }).catch(() => {});
  };

  const persistLatestState = () => {
    if (!canEdit) return persistQueue;
    dirty = false;
    persistQueue = persistQueue
      .catch(() => {})
      .then(async () => {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            state: bytesToBase64(encodeNoteState(doc)),
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Unable to persist collaborative note (${response.status}).`,
          );
        }
      })
      .catch((error) => {
        dirty = true;
        throw error;
      });
    return persistQueue;
  };

  const schedulePersist = () => {
    if (!canEdit) return;
    dirty = true;
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void persistLatestState().catch(() => {});
    }, persistDebounceMs);
  };

  const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_UPDATE_ORIGIN || destroyed || !canEdit) return;
    broadcastState(update);
    schedulePersist();
  };

  channel = client
    .channel(noteTopicForItem(itemId), {
      config: {
        private: true,
        broadcast: { self: false },
      },
    })
    .on("broadcast", { event: "yjs-update" }, (payload) => {
      const update = parseBroadcastPayload(payload);
      if (!update) return;
      try {
        applyNoteUpdate(
          doc,
          base64ToBytes(update.state),
          REMOTE_UPDATE_ORIGIN,
        );
      } catch {
        // A later full-state update or reload can heal a malformed/missed relay.
      }
    })
    .subscribe((status) => {
      subscribed = status === "SUBSCRIBED";
      if (subscribed && dirty) {
        broadcastState(encodeNoteState(doc));
      }
    });

  doc.on("update", handleDocUpdate);

  try {
    await loadInitialState({ itemId, doc, fetchImpl });
  } catch (error) {
    doc.off("update", handleDocUpdate);
    await client.removeChannel(channel);
    throw error;
  }

  const flush = async () => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await persistQueue.catch(() => {});
    if (dirty) {
      await persistLatestState();
    }
  };

  const teardown = Object.assign(
    async () => {
      if (destroyed) return;
      destroyed = true;
      doc.off("update", handleDocUpdate);
      await flush().catch(() => {});
      await client.removeChannel(channel);
    },
    { flush },
  );

  return teardown;
}
