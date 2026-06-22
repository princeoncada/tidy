import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { ItemNotesField } from "@/components/item/ItemNotesField";

describe("ItemNotesField", () => {
  it("shows the stored note before the Yjs provider loads", () => {
    render(
      <ItemNotesField
        itemId="11111111-1111-4111-8111-111111111111"
        canEdit
        initialNotes="stored note"
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Item notes" });
    expect(textarea).toHaveValue("stored note");
    expect(textarea).toHaveAttribute("readonly");
  });
});
