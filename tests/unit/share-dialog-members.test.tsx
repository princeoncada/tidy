import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const trpcMocks = vi.hoisted(() => ({
  useQuery: vi.fn((options: { queryKey: unknown[] }) => {
    if (options.queryKey[1] === "listMembers") {
      return {
        data: [
          {
            userId: "11111111-1111-4111-8111-111111111111",
            label: "Avery Admin",
            role: "OWNER",
          },
          {
            userId: "22222222-2222-4222-8222-222222222222",
            label: "editor@example.com",
            role: "EDITOR",
          },
        ],
      };
    }
    return { data: [] };
  }),
  useMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: trpcMocks.useQuery,
    useMutation: trpcMocks.useMutation,
    useQueryClient: () => queryClientMocks,
  };
});

vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    share: {
      listShareLinks: {
        queryOptions: (input: unknown) => ({
          queryKey: ["share", "listShareLinks", input],
        }),
        queryKey: (input: unknown) => ["share", "listShareLinks", input],
      },
      listMembers: {
        queryOptions: (input: unknown) => ({
          queryKey: ["share", "listMembers", input],
        }),
        queryKey: (input: unknown) => ["share", "listMembers", input],
      },
      createShareLink: {
        mutationOptions: () => ({}),
      },
      revokeShareLink: {
        mutationOptions: () => ({}),
      },
      updateMemberRole: {
        mutationOptions: () => ({}),
      },
      removeMember: {
        mutationOptions: () => ({}),
      },
    },
  }),
}));

import { ShareDialog } from "@/components/sharing/ShareDialog";

describe("ShareDialog members", () => {
  it("shows human labels and keeps raw ids in title text", () => {
    render(
      <ShareDialog
        resourceType="LIST"
        resourceId="11111111-1111-4111-8111-111111111111"
        title="Project list"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByText("Avery Admin")).toHaveAttribute(
      "title",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("editor@example.com")).toHaveAttribute(
      "title",
      "22222222-2222-4222-8222-222222222222",
    );
  });
});
