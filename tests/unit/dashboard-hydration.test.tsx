import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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

vi.mock("@/lib/sync/replicache/client", () => ({
  isReplicacheRenderEnabled: () => false,
}));

vi.mock("@/components/ReplicacheProvider", () => ({
  ReplicacheProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/UserAccountNav", () => ({
  default: () => <div>User</div>,
}));

vi.mock("@/components/SyncStatusBadge", () => ({
  default: () => <div>Sync</div>,
}));

vi.mock("@/components/sharing/WorkspacesDialog", () => ({
  WorkspacesDialog: () => <div>Workspaces</div>,
}));

vi.mock("@/components/list/ListAdder", () => ({
  default: () => <div>Add list</div>,
}));

vi.mock("@/components/list/ListsContainer", () => ({
  default: () => <div>Lists</div>,
}));

vi.mock("@/components/views/ViewsSidebarPreview", () => ({
  default: () => <div>Views</div>,
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
      'class="w-full max-w-7xl min-h-full xl:px-0 px-2 flex items-center justify-center"',
    );
    expect(html).not.toContain('data-testid="app-shell"');
  });

  it("renders the dashboard after mounting", () => {
    render(<Dashboard />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
