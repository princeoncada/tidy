import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/item-panel/item-panel-gate", () => ({
  isItemPanelEnabled: () => true,
}));

vi.mock("@/lib/collab/yjs-notes-gate", () => ({
  isYjsNotesEnabled: () => true,
}));

vi.mock("@/lib/collab/note-provider", () => ({
  connectNoteProvider: vi.fn(
    () => new Promise<never>(() => {}),
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "access-token",
            user: { id: "user-1" },
          },
        },
      })),
    },
  }),
}));

import { ItemDetailPanel } from "@/components/item/ItemDetailPanel";
import type { ListItem } from "@/components/list/types";

describe("ItemDetailPanel", () => {
  it("shows item metadata and the stored collaborative note", () => {
    const listItem: ListItem = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Buy milk",
      completed: false,
      order: 0,
      notes: "stored note",
      listId: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-06-22T12:00:00.000Z"),
      updatedAt: new Date("2026-06-22T12:00:00.000Z"),
    };

    render(
      <ItemDetailPanel
        open
        onOpenChange={() => {}}
        listItem={listItem}
        canEdit
      />,
    );

    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Item notes" })).toHaveValue(
      "stored note",
    );
  });
});
