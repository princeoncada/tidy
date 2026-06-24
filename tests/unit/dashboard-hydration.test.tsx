import { act, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "@/components/Dashboard";

const {
  clearMock,
  replaceMock,
  signOutMock,
  useLocalFirstDashboardBootMock,
} = vi.hoisted(() => ({
  clearMock: vi.fn(),
  replaceMock: vi.fn(),
  signOutMock: vi.fn(),
  useLocalFirstDashboardBootMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: clearMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

vi.mock("@/hooks/useLocalFirstDashboardBoot", () => ({
  useLocalFirstDashboardBoot: useLocalFirstDashboardBootMock,
}));

vi.mock("@/components/ReplicacheProvider", () => ({
  ReplicacheProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/UserAccountNav", () => ({
  default: () => <div>User</div>,
}));

vi.mock("@/components/list/ListsContainer", () => ({
  default: () => <div>Lists</div>,
}));

vi.mock("@/components/board/BoardContainer", () => ({
  default: () => <div>Board</div>,
}));

vi.mock("@/components/layout/SidebarNav", () => ({
  SidebarNav: () => <div>Sidebar</div>,
}));

describe("dashboard hydration", () => {
  beforeEach(() => {
    clearMock.mockReset();
    replaceMock.mockReset();
    signOutMock.mockReset();
    useLocalFirstDashboardBootMock.mockReset();
    useLocalFirstDashboardBootMock.mockReturnValue({
      localViews: undefined,
      localCurrentView: undefined,
      localBootReady: true,
      userId: "user-1",
    });
  });

  it("server-renders the stable loading wrapper before client-only state is available", () => {
    const html = renderToString(<Dashboard />);

        expect(html).toContain(
          'class="w-full min-h-full xl:px-0 px-2 max-w-7xl flex items-center justify-center"',
        );
    expect(html).not.toContain('data-testid="app-shell"');
  });

  it("hydrates the loading shell before rendering the dashboard", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Dashboard />);
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <Dashboard />);
      });
      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
      expect(
        consoleError.mock.calls.some(([message]) =>
          String(message).includes("Hydration failed")
        ),
      ).toBe(false);
    } finally {
      if (root) {
        await act(async () => {
          root?.unmount();
        });
      }
      consoleError.mockRestore();
      container.remove();
    }
  });
});
