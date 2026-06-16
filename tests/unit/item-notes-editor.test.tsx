import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { ItemNotesEditor } from "@/components/list/ItemNotesEditor";

describe("ItemNotesEditor", () => {
  it("shows the stored note before the Yjs provider loads", () => {
    render(
      <ItemNotesEditor
        itemId="11111111-1111-4111-8111-111111111111"
        canEdit
        initialNotes="stored note"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));

    const textarea = screen.getByRole("textbox", { name: "Item notes" });
    expect(textarea).toHaveValue("stored note");
    expect(textarea).toHaveAttribute("readonly");
  });
});
