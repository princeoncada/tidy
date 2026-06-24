import { describe, expect, it } from "vitest";

import {
  mergePresenceRosters,
} from "@/lib/realtime/use-presence-rooms";
import type { PresenceMember } from "@/lib/realtime/presence-client";

describe("mergePresenceRosters", () => {
  it("dedupes users across list rooms with the newest meta winning", () => {
    const rostersByRoom: ReadonlyMap<string, PresenceMember[]> = new Map([
      [
        "list-1",
        [
          { userId: "user-2", clientKey: "client-a", typing: false, at: 10 },
          { userId: "user-1", clientKey: "client-b", at: 20 },
        ],
      ],
      [
        "list-2",
        [
          { userId: "user-2", clientKey: "client-c", typing: true, at: 30 },
        ],
      ],
    ]);

    expect(mergePresenceRosters(rostersByRoom)).toEqual([
      { userId: "user-1", clientKey: "client-b", at: 20 },
      { userId: "user-2", clientKey: "client-c", typing: true, at: 30 },
    ]);
  });
});
