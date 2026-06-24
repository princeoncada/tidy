import {
  PresenceRoom,
  type PresenceBroadcastEvent,
  type PresenceMember,
} from "@/lib/realtime/presence-client";
import { createClient } from "@/lib/supabase/client";

export const PRESENCE_SPIKE_STORAGE_KEY = "tidy:presence-spike";

type PresenceSpikeStorage = Pick<Storage, "getItem">;

export type PresenceSpikeWindowApi = {
  join: (roomId: string) => Promise<void>;
  updateCursor: (x: number, y: number) => void;
  setTyping: (typing: boolean) => void;
  roster: () => PresenceMember[];
  events: () => PresenceBroadcastEvent[];
  leave: () => void;
};

declare global {
  interface Window {
    __tidyPresenceSpike?: PresenceSpikeWindowApi;
  }
}

export function isPresenceSpikeEnabled({
  nodeEnv = process.env.NODE_ENV,
  storage,
}: {
  nodeEnv?: string;
  storage?: PresenceSpikeStorage | null;
} = {}) {
  if (nodeEnv === "production") return false;

  try {
    const resolvedStorage =
      storage === undefined
        ? typeof window === "undefined"
          ? null
          : window.localStorage
        : storage;
    return resolvedStorage?.getItem(PRESENCE_SPIKE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function installPresenceSpikeWindowApi({ userId }: { userId: string }) {
  if (!isPresenceSpikeEnabled() || typeof window === "undefined") {
    return () => {};
  }

  let room: PresenceRoom | null = null;

  const leave = () => {
    room?.leave();
    room = null;
  };

  const api: PresenceSpikeWindowApi = {
    join: async (roomId) => {
      leave();
      const {
        data: { session },
      } = await createClient().auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const nextRoom = new PresenceRoom({
        roomId,
        userId,
        accessToken,
      });
      await nextRoom.join();
      room = nextRoom;
    },
    updateCursor: (x, y) => room?.updateCursor(x, y),
    setTyping: (typing) => room?.setTyping(typing),
    roster: () => room?.roster() ?? [],
    events: () => room?.events() ?? [],
    leave,
  };

  window.__tidyPresenceSpike = api;
  return () => {
    leave();
    if (window.__tidyPresenceSpike === api) {
      delete window.__tidyPresenceSpike;
    }
  };
}
