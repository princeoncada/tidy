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
    <MaxWidthWrapper>
      <div className="flex gap-4">
        <main data-testid="app-shell" className="min-w-0 flex-1 flex flex-col gap-3 py-10">
          <div className="flex flex-col gap-2.5 w-full items-center">
            <div className="w-full flex flex-col">
              <div className="w-full flex justify-between items-end h-12">
                <div className="flex gap-3 items-end">
                  <UserAccountNav logout={handleLogout} />
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    Your Todo Lists
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <WorkspacesDialog />
                  <ListAdder boot={localFirstBoot} />
                </div>
              </div>
            </div>

            <div className="w-full lg:hidden">
              <ViewsSidebarPreview userId={localFirstBoot.userId} />
            </div>

            <Separator className="bg-zinc-200 md:bg-zinc-200/30" />
          </div>

          <ListsContainer boot={localFirstBoot} />
        </main>

        <aside className="hidden lg:block w-64 shrink-0 py-11">
          <div className="sticky top-4">
            <ViewsSidebarPreview userId={localFirstBoot.userId} />
          </div>
        </aside>
      </div>
    </MaxWidthWrapper>
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
