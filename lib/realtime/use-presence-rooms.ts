"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  PresenceRoom,
  type PresenceBroadcastEvent,
  type PresenceMember,
} from "@/lib/realtime/presence-client";
import { createClient } from "@/lib/supabase/client";

const CURSOR_SEND_INTERVAL_MS = 80;

export type PresenceCursor = PresenceBroadcastEvent & {
  roomId: string;
};

type UsePresenceRoomsOptions = {
  enabled: boolean;
  roomIds: ReadonlyArray<string>;
  userId: string | null;
};

function normalizeRoomIds(roomIds: ReadonlyArray<string>) {
  return Array.from(new Set(roomIds.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function mergePresenceRosters(
  rostersByRoom: ReadonlyMap<string, ReadonlyArray<PresenceMember>>,
) {
  const newestByUser = new Map<string, PresenceMember>();

  for (const roster of rostersByRoom.values()) {
    for (const member of roster) {
      const current = newestByUser.get(member.userId);
      if (!current || member.at >= current.at) {
        newestByUser.set(member.userId, member);
      }
    }
  }

  return Array.from(newestByUser.values()).sort((left, right) =>
    left.userId.localeCompare(right.userId),
  );
}

export function usePresenceRooms({
  enabled,
  roomIds,
  userId,
}: UsePresenceRoomsOptions) {
  const normalizedRoomIds = useMemo(() => normalizeRoomIds(roomIds), [roomIds]);
  const roomKey = normalizedRoomIds.join("\n");
  const roomsRef = useRef<PresenceRoom[]>([]);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const lastCursorSentAtRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [rostersByRoom, setRostersByRoom] = useState(
    () => new Map<string, PresenceMember[]>(),
  );
  const [cursorsByUser, setCursorsByUser] = useState(
    () => new Map<string, PresenceCursor>(),
  );

  const leaveRooms = useCallback(() => {
    for (const room of roomsRef.current) {
      room.leave();
    }
    roomsRef.current = [];
  }, []);

  const resetPresenceState = useCallback(() => {
    setConnected(false);
    setRostersByRoom(new Map());
    setCursorsByUser(new Map());
  }, []);

  const flushCursor = useCallback(() => {
    const cursor = pendingCursorRef.current;
    pendingCursorRef.current = null;
    lastCursorSentAtRef.current = Date.now();
    if (!cursor) return;

    for (const room of roomsRef.current) {
      room.updateCursor(cursor.x, cursor.y);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const shouldConnect = enabled && Boolean(userId) && roomKey.length > 0;

    leaveRooms();

    if (!shouldConnect) {
      return () => {
        disposed = true;
      };
    }

    void Promise.resolve().then(() => {
      if (!disposed) resetPresenceState();
    });

    const activeRoomIds = roomKey.split("\n");

    void createClient()
      .auth.getSession()
      .then(async ({ data: { session } }) => {
        const accessToken = session?.access_token;
        if (!accessToken || disposed) return;

        const joinedRooms: PresenceRoom[] = [];

        for (const roomId of activeRoomIds) {
          if (disposed) break;

          const room = new PresenceRoom({
            roomId,
            userId,
            accessToken,
            onRosterChange: (roster) => {
              setRostersByRoom((current) => {
                const next = new Map(current);
                next.set(roomId, roster);
                return next;
              });
            },
            onCursorEvent: (event) => {
              if (event.userId === userId) return;

              setCursorsByUser((current) => {
                const next = new Map(current);
                const existing = next.get(event.userId);
                if (!existing || event.at >= existing.at) {
                  next.set(event.userId, { ...event, roomId });
                }
                return next;
              });
            },
          });

          await room.join();
          joinedRooms.push(room);
        }

        if (disposed) {
          for (const room of joinedRooms) {
            room.leave();
          }
          return;
        }

        roomsRef.current = joinedRooms;
        setConnected(joinedRooms.length > 0);
      })
      .catch(() => {
        if (!disposed) {
          leaveRooms();
          resetPresenceState();
        }
      });

    return () => {
      disposed = true;
      leaveRooms();
    };
  }, [enabled, leaveRooms, resetPresenceState, roomKey, userId]);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!enabled || roomsRef.current.length === 0) return;

      pendingCursorRef.current = { x, y };
      const elapsed = Date.now() - lastCursorSentAtRef.current;

      if (elapsed >= CURSOR_SEND_INTERVAL_MS) {
        if (cursorTimerRef.current) {
          window.clearTimeout(cursorTimerRef.current);
          cursorTimerRef.current = null;
        }
        flushCursor();
        return;
      }

      if (!cursorTimerRef.current) {
        cursorTimerRef.current = window.setTimeout(() => {
          cursorTimerRef.current = null;
          flushCursor();
        }, CURSOR_SEND_INTERVAL_MS - elapsed);
      }
    },
    [enabled, flushCursor],
  );

  const setTyping = useCallback((typing: boolean) => {
    for (const room of roomsRef.current) {
      room.setTyping(typing);
    }
  }, []);

  const roster = useMemo(
    () => mergePresenceRosters(rostersByRoom),
    [rostersByRoom],
  );

  return {
    connected,
    roster,
    peers: roster.filter((member) => member.userId !== userId),
    cursors: Array.from(cursorsByUser.values()).filter(
      (cursor) =>
        typeof cursor.cursorX === "number" &&
        typeof cursor.cursorY === "number",
    ),
    updateCursor,
    setTyping,
  };
}
