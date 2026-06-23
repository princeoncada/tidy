import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutationMocks = vi.hoisted(() => ({
  updateItem: vi.fn(),
}));

const trpcMocks = vi.hoisted(() => ({
  queryOptions: vi.fn((input: { listId: string }) => ({
    queryKey: ["listItem", "getAssignableMembers", input],
  })),
  useQuery: vi.fn(() => ({
    data: {
      currentUserId: "user-1",
      members: ["user-1", "user-2"],
    },
  })),
}));

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

vi.mock("@/hooks/useDashboardMutations", () => ({
  useDashboardMutations: () => ({
    mutate: mutationMocks,
  }),
}));

vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    listItem: {
      getAssignableMembers: {
        queryOptions: trpcMocks.queryOptions,
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: trpcMocks.useQuery,
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows item metadata and the stored collaborative note", () => {
    const listItem = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Buy milk",
      completed: false,
      order: 0,
      notes: "stored note",
      status: "TODO",
      assigneeId: null,
      listId: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-06-22T12:00:00.000Z"),
      updatedAt: new Date("2026-06-22T12:00:00.000Z"),
    } as ListItem;

    render(
      <ItemDetailPanel
        open
        onOpenChange={() => {}}
        listItem={listItem}
        canEdit
        currentUserId="user-1"
      />,
    );

    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("TODO");
    expect(screen.getByLabelText("Assignee")).toHaveValue("");
    expect(screen.getByRole("option", { name: "user-1 (you)" }))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Item notes" })).toHaveValue(
      "stored note",
    );
  });

  it("updates status and assignee through the dashboard mutator", () => {
    const listItem = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Buy milk",
      completed: false,
      order: 0,
      notes: "stored note",
      status: "TODO",
      assigneeId: null,
      listId: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-06-22T12:00:00.000Z"),
      updatedAt: new Date("2026-06-22T12:00:00.000Z"),
    } as ListItem;

    render(
      <ItemDetailPanel
        open
        onOpenChange={() => {}}
        listItem={listItem}
        canEdit
        currentUserId="user-1"
      />,
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "IN_PROGRESS" },
    });
    fireEvent.change(screen.getByLabelText("Assignee"), {
      target: { value: "user-2" },
    });
    fireEvent.change(screen.getByLabelText("Assignee"), {
      target: { value: "" },
    });

    expect(mutationMocks.updateItem).toHaveBeenCalledWith({
      id: listItem.id,
      status: "IN_PROGRESS",
      now: expect.any(String),
    });
    expect(mutationMocks.updateItem).toHaveBeenCalledWith({
      id: listItem.id,
      assigneeId: "user-2",
      now: expect.any(String),
    });
    expect(mutationMocks.updateItem).toHaveBeenCalledWith({
      id: listItem.id,
      assigneeId: null,
      now: expect.any(String),
    });
  });
});
