import { presenceTopicForRoom } from "@/lib/realtime/presence-topic";
import { createClient } from "@/lib/supabase/client";

export const PRESENCE_SPIKE_STORAGE_KEY = "tidy:presence-spike";

export const DEFAULT_MAX_PRESENCE_EVENTS = 1_000;

type PresenceSpikeStorage = Pick<Storage, "getItem">;

export type PresenceMember = {
  userId: string;
  clientKey: string;
  cursorX?: number;
  cursorY?: number;
  typing?: boolean;
  at: number;
};

export type PresenceBroadcastEvent = PresenceMember & {
  type: "cursor";
};

type PresenceMeta = Partial<PresenceMember>;
type PresenceState = Record<string, PresenceMeta[]>;

type RealtimeChannel = {
  on: (
    type: "presence" | "broadcast",
    filter: Record<string, string>,
    callback: (payload?: unknown) => void,
  ) => RealtimeChannel;
  subscribe: (callback?: (status: string) => void) => RealtimeChannel;
  track: (payload: PresenceMember) => Promise<unknown> | unknown;
  send: (payload: {
    type: "broadcast";
    event: "cursor";
    payload: PresenceBroadcastEvent;
  }) => Promise<unknown> | unknown;
  presenceState?: () => PresenceState;
};

type RealtimeClient = {
  realtime: {
    setAuth: (accessToken: string) => Promise<unknown>;
  };
  channel: (
    topic: string,
    options: {
      config: {
        private: true;
        presence: { key: string };
        broadcast: { self: false };
      };
    },
  ) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => Promise<unknown> | unknown;
};

type PresenceSpikeRoomOptions = {
  roomId: string;
  userId: string;
  accessToken: string;
  clientKey?: string;
  clientFactory?: () => RealtimeClient;
  maxEvents?: number;
  now?: () => number;
};

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

function createClientKey() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `client-${randomId}`
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeMember(meta: PresenceMeta): PresenceMember | null {
  if (
    typeof meta.userId !== "string" ||
    typeof meta.clientKey !== "string" ||
    !isFiniteNumber(meta.at)
  ) {
    return null;
  }

  return {
    userId: meta.userId,
    clientKey: meta.clientKey,
    ...(isFiniteNumber(meta.cursorX) ? { cursorX: meta.cursorX } : {}),
    ...(isFiniteNumber(meta.cursorY) ? { cursorY: meta.cursorY } : {}),
    ...(typeof meta.typing === "boolean" ? { typing: meta.typing } : {}),
    at: meta.at,
  };
}

function presenceStateFromChannel(channel: RealtimeChannel | null) {
  try {
    return channel?.presenceState?.() ?? {};
  } catch {
    return {};
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

export function rosterFromPresenceState(state: PresenceState) {
  const newestByUser = new Map<string, PresenceMember>();

  for (const metas of Object.values(state)) {
    if (!Array.isArray(metas)) continue;
    for (const meta of metas) {
      const member = normalizeMember(meta);
      if (!member) continue;

      const current = newestByUser.get(member.userId);
      if (!current || member.at >= current.at) {
        newestByUser.set(member.userId, member);
      }
    }
  }

  return Array.from(newestByUser.values()).sort((a, b) =>
    a.userId.localeCompare(b.userId),
  );
}

export function diffRosters(
  prev: ReadonlyArray<PresenceMember>,
  next: ReadonlyArray<PresenceMember>,
) {
  const prevUsers = new Set(prev.map((member) => member.userId));
  const nextUsers = new Set(next.map((member) => member.userId));

  return {
    joined: next.filter((member) => !prevUsers.has(member.userId)),
    left: prev.filter((member) => !nextUsers.has(member.userId)),
  };
}

export class PresenceEventBuffer {
  private readonly maxEvents: number;
  private readonly recordedEvents: PresenceBroadcastEvent[] = [];

  constructor(maxEvents = DEFAULT_MAX_PRESENCE_EVENTS) {
    this.maxEvents = Math.max(1, maxEvents);
  }

  record(event: PresenceBroadcastEvent) {
    this.recordedEvents.push({ ...event });
    if (this.recordedEvents.length > this.maxEvents) {
      this.recordedEvents.splice(
        0,
        this.recordedEvents.length - this.maxEvents,
      );
    }
  }

  events() {
    return this.recordedEvents.map((event) => ({ ...event }));
  }

  clear() {
    this.recordedEvents.length = 0;
  }
}

export class PresenceSpikeRoom {
  readonly roomId: string;
  readonly userId: string;
  readonly clientKey: string;

  private readonly accessToken: string;
  private readonly clientFactory: () => RealtimeClient;
  private readonly now: () => number;
  private readonly eventBuffer: PresenceEventBuffer;
  private client: RealtimeClient | null = null;
  private channel: RealtimeChannel | null = null;
  private currentRoster: PresenceMember[] = [];
  private cursorX: number | undefined;
  private cursorY: number | undefined;
  private typing = false;

  constructor({
    roomId,
    userId,
    accessToken,
    clientKey = createClientKey(),
    clientFactory = () => createClient() as unknown as RealtimeClient,
    maxEvents,
    now = Date.now,
  }: PresenceSpikeRoomOptions) {
    this.roomId = roomId;
    this.userId = userId;
    this.accessToken = accessToken;
    this.clientKey = clientKey;
    this.clientFactory = clientFactory;
    this.eventBuffer = new PresenceEventBuffer(maxEvents);
    this.now = now;
  }

  async join() {
    const client = this.clientFactory();
    await client.realtime.setAuth(this.accessToken);

    const channel = client
      .channel(presenceTopicForRoom(this.roomId), {
        config: {
          private: true,
          presence: { key: this.clientKey },
          broadcast: { self: false },
        },
      })
      .on("presence", { event: "sync" }, () => this.refreshRoster())
      .on("presence", { event: "join" }, () => this.refreshRoster())
      .on("presence", { event: "leave" }, () => this.refreshRoster())
      .on("broadcast", { event: "cursor" }, (payload) => {
        const event = parseBroadcastEvent(payload);
        if (event) this.eventBuffer.record(event);
      });

    this.client = client;
    this.channel = channel;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void this.trackSelf();
      }
    });
    this.refreshRoster();
  }

  updateCursor(x: number, y: number) {
    this.cursorX = x;
    this.cursorY = y;
    this.publishSelf();
  }

  setTyping(typing: boolean) {
    this.typing = typing;
    this.publishSelf();
  }

  roster() {
    return this.currentRoster.map((member) => ({ ...member }));
  }

  events() {
    return this.eventBuffer.events();
  }

  leave() {
    const channel = this.channel;
    const client = this.client;
    this.channel = null;
    this.client = null;
    this.currentRoster = [];
    this.eventBuffer.clear();
    if (client && channel) {
      void client.removeChannel(channel);
    }
  }

  private selfMeta(): PresenceMember {
    return {
      userId: this.userId,
      clientKey: this.clientKey,
      ...(isFiniteNumber(this.cursorX) ? { cursorX: this.cursorX } : {}),
      ...(isFiniteNumber(this.cursorY) ? { cursorY: this.cursorY } : {}),
      typing: this.typing,
      at: this.now(),
    };
  }

  private refreshRoster() {
    const nextRoster = rosterFromPresenceState(
      presenceStateFromChannel(this.channel),
    );
    diffRosters(this.currentRoster, nextRoster);
    this.currentRoster = nextRoster;
  }

  private trackSelf() {
    return this.channel?.track(this.selfMeta());
  }

  private publishSelf() {
    const channel = this.channel;
    if (!channel) return;

    const payload: PresenceBroadcastEvent = {
      type: "cursor",
      ...this.selfMeta(),
    };
    void channel.track(payload);
    void channel.send({
      type: "broadcast",
      event: "cursor",
      payload,
    });
  }
}

function parseBroadcastEvent(value: unknown): PresenceBroadcastEvent | null {
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

  const record = payload as PresenceMeta & { type?: unknown };
  if (record.type !== "cursor") return null;

  const member = normalizeMember(record);
  return member ? { type: "cursor", ...member } : null;
}

export function installPresenceSpikeWindowApi({ userId }: { userId: string }) {
  if (!isPresenceSpikeEnabled() || typeof window === "undefined") {
    return () => {};
  }

  let room: PresenceSpikeRoom | null = null;

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

      const nextRoom = new PresenceSpikeRoom({
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
