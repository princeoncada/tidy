"use client";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BoardContainer from "./board/BoardContainer";
import ListsContainer from "./list/ListsContainer";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import UserAccountNav from "./UserAccountNav";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";
import { ReplicacheProvider } from "@/components/ReplicacheProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { isBoardEnabled } from "@/lib/board/board-gate";
import HistoryPanel from "@/components/history/HistoryPanel";

const supabase = createClient();

const Dashboard = () => {

  const [loggingOut, setLoggingOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState(false);
  const boardEnabled = isBoardEnabled();

  const queryClient = useQueryClient();
  const router = useRouter();
  const localFirstBoot = useLocalFirstDashboardBoot();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  function handleLogout() {
    setLoggingOut(true);
    supabase.auth.signOut();
    queryClient.clear();
    router.replace("/");
  }

  if (!hydrated || loggingOut) {
    return <MaxWidthWrapper singleItemPage={true}>
      <Loader2 className="w-5 h-5 animate-spin" />
    </MaxWidthWrapper>;
  }

  const dashboard = (
    <AppShell
      sidebar={(
        <SidebarNav
          boot={localFirstBoot}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
        />
      )}
      footer={({ collapsed, requestExpand }) => (
        <UserAccountNav
          logout={handleLogout}
          collapsed={collapsed}
          onRequestExpand={requestExpand}
        />
      )}
    >
      <main
        data-testid="app-shell"
        className="h-dvh min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 lg:px-4 xl:px-6 2xl:px-8"
      >
        <MaxWidthWrapper fullWidth>
          <div className="flex min-w-0 flex-col gap-3 py-12 lg:py-10">
            <div className="flex flex-col gap-2.5 w-full items-center">
              <div className="w-full flex flex-col">
                <div className="flex h-12 w-full items-end justify-between gap-3">
                  <h1 className="text-xl md:text-2xl font-bold text-text">
                    Your Todo Lists
                  </h1>
                  <div className="flex items-center gap-2">
                    <HistoryPanel />
                    {boardEnabled && (
                      <div
                        className="flex rounded-lg border border-border bg-surface-muted p-0.5"
                        aria-label="Dashboard view"
                      >
                        <Button
                          type="button"
                          variant={boardMode ? "ghost" : "secondary"}
                          size="sm"
                          aria-pressed={!boardMode}
                          aria-label="Show list view"
                          onClick={() => setBoardMode(false)}
                        >
                          List
                        </Button>
                        <Button
                          type="button"
                          variant={boardMode ? "secondary" : "ghost"}
                          size="sm"
                          aria-pressed={boardMode}
                          aria-label="Show board view"
                          onClick={() => setBoardMode(true)}
                        >
                          Board
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-border md:bg-border/30" />
            </div>

            {boardEnabled && boardMode ? (
              <BoardContainer
                boot={localFirstBoot}
                activeWorkspaceId={activeWorkspaceId}
              />
            ) : (
              <ListsContainer
                boot={localFirstBoot}
                activeWorkspaceId={activeWorkspaceId}
              />
            )}
          </div>
        </MaxWidthWrapper>
      </main>
    </AppShell>
  );

  if (!localFirstBoot.localBootReady) {
    return (
      <MaxWidthWrapper singleItemPage={true}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </MaxWidthWrapper>
    );
  }

  if (!localFirstBoot.userId) return dashboard;

  return (
    <ReplicacheProvider userId={localFirstBoot.userId}>
      {dashboard}
    </ReplicacheProvider>
  );
};

export default Dashboard;
