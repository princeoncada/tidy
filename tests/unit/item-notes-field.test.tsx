import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const noteProviderMocks = vi.hoisted(() => ({
  connectNoteProvider: vi.fn<() => Promise<unknown>>(
    () => new Promise(() => {}),
  ),
}));

vi.mock("@/lib/collab/note-provider", () => ({
  connectNoteProvider: noteProviderMocks.connectNoteProvider,
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
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

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

  it("publishes local typing state while editable notes change", async () => {
    const teardown = Object.assign(vi.fn(async () => undefined), {
      flush: vi.fn(async () => undefined),
    });
    noteProviderMocks.connectNoteProvider.mockResolvedValueOnce(teardown);
    const handleTypingChange = vi.fn();

    render(
      <ItemNotesField
        itemId="11111111-1111-4111-8111-111111111111"
        canEdit
        initialNotes="stored note"
        onTypingChange={handleTypingChange}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Item notes" });
    await waitFor(() => expect(textarea).not.toHaveAttribute("readonly"));

    vi.useFakeTimers();
    fireEvent.change(textarea, { target: { value: "updated note" } });

    expect(handleTypingChange).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(1_500);

    expect(handleTypingChange).toHaveBeenCalledWith(false);
  });
});
