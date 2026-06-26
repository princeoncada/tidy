import { describe, expect, it } from "vitest";

import {
  formatMutationLedgerEntry,
  humanizeMutationName,
} from "@/lib/history/history-format";

describe("humanizeMutationName", () => {
  it("uses overrides for known mutator names", () => {
    expect(humanizeMutationName("setSelectedView")).toBe("Set Selected View");
  });

  it("falls back to title-cased words", () => {
    expect(humanizeMutationName("syncCustomThing")).toBe("Sync Custom Thing");
    expect(humanizeMutationName("sync_custom-thing")).toBe("Sync Custom Thing");
  });

  it("uses Change for empty names", () => {
    expect(humanizeMutationName("")).toBe("Change");
    expect(humanizeMutationName("   ")).toBe("Change");
  });
});

describe("formatMutationLedgerEntry", () => {
  it("formats list counts and Date timestamps", () => {
    expect(formatMutationLedgerEntry({
      id: "entry-1",
      name: "createList",
      affectedListIds: [],
      createdAt: new Date("2026-06-26T01:02:03.000Z"),
    })).toEqual({
      id: "entry-1",
      title: "Create List",
      detail: "No lists affected",
      affectedListCount: 0,
      at: "2026-06-26T01:02:03.000Z",
    });

    expect(formatMutationLedgerEntry({
      id: "entry-2",
      name: "updateItem",
      affectedListIds: ["list-1"],
      createdAt: new Date("2026-06-26T02:03:04.000Z"),
    })).toMatchObject({
      detail: "1 list affected",
      affectedListCount: 1,
      at: "2026-06-26T02:03:04.000Z",
    });
  });

  it("passes through ISO string timestamps and pluralizes list counts", () => {
    expect(formatMutationLedgerEntry({
      id: "entry-3",
      name: "reorderItems",
      affectedListIds: ["list-1", "list-2"],
      createdAt: "2026-06-26T03:04:05.000Z",
    })).toEqual({
      id: "entry-3",
      title: "Reorder Items",
      detail: "2 lists affected",
      affectedListCount: 2,
      at: "2026-06-26T03:04:05.000Z",
    });
  });
});
