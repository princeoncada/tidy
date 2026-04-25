"use client";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { useState } from "react";
import ListAdder from "./list/ListAdder";
import ListsContainer from "./list/ListsContainer";
import { Separator } from "./ui/separator";
import UserAccountNav from "./UserAccountNav";

const supabase = createClient();

const Dashboard = () => {

  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    setLoggingOut(true);
    supabase.auth.signOut();
    redirect('/');
  }

  if (loggingOut) {
    return <MaxWidthWrapper singleItemPage={true}>
      <Loader2 className="w-5 h-5 animate-spin" />;
    </MaxWidthWrapper>;
  }

  return (
    <MaxWidthWrapper>
      <div className="flex relative">
        <div className="flex-1 flex flex-col gap-3 py-10">
          <div className="flex flex-col gap-2.5 w-full items-center">
            <div className="w-full flex flex-col">
              <div className="w-full flex justify-between items-end h-12">
                <div className="flex gap-3 items-end">
                  <UserAccountNav logout={handleLogout} />
                  <h1 className="text-[28px] md:text-[32px] font-bold text-gray-900">
                    Your Todo Lists
                  </h1>
                </div>
                <ListAdder />
              </div>
            </div>
            <Separator className="bg-zinc-200 md:bg-zinc-200/30" />
          </div>
          <ListsContainer />
        </div>
      </div>
    </MaxWidthWrapper>
  );
};

export default Dashboard;