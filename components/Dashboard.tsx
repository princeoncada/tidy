"use client";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ListAdder from "./list/ListAdder";
import ListsContainer from "./list/ListsContainer";
import { Separator } from "./ui/separator";
import UserAccountNav from "./UserAccountNav";
import { useQueryClient } from "@tanstack/react-query";
import ViewsSidebarPreview from "./views/ViewsSidebarPreview";
import { useLocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";
import { ReplicacheProvider } from "@/components/ReplicacheProvider";
import { WorkspacesDialog } from "@/components/sharing/WorkspacesDialog";
import { AppShell } from "@/components/layout/AppShell";

const supabase = createClient();

const Dashboard = () => {

  const [loggingOut, setLoggingOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
    <AppShell sidebar={<ViewsSidebarPreview userId={localFirstBoot.userId} />}>
      <main
        data-testid="app-shell"
        className="h-dvh min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 lg:px-4 xl:px-6 2xl:px-8"
      >
        <MaxWidthWrapper>
          <div className="flex min-w-0 flex-col gap-3 py-12 lg:py-10">
            <div className="flex flex-col gap-2.5 w-full items-center">
              <div className="w-full flex flex-col">
                <div className="w-full flex justify-between items-end h-12">
                  <div className="flex gap-3 items-end">
                    <UserAccountNav logout={handleLogout} />
                    <h1 className="text-xl md:text-2xl font-bold text-text">
                      Your Todo Lists
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <WorkspacesDialog />
                    <ListAdder boot={localFirstBoot} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border md:bg-border/30" />
            </div>

            <ListsContainer boot={localFirstBoot} />
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
