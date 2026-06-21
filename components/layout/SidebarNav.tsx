"use client";

import type { LocalFirstDashboardBoot } from "@/hooks/useLocalFirstDashboardBoot";

import ListAdder from "@/components/list/ListAdder";
import ViewsSidebarPreview from "@/components/views/ViewsSidebarPreview";

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function SidebarNav({
  boot,
  activeWorkspaceId,
  onSelectWorkspace,
}: {
  boot: LocalFirstDashboardBoot;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <ListAdder boot={boot} />
      <WorkspaceSwitcher
        activeWorkspaceId={activeWorkspaceId}
        onSelect={onSelectWorkspace}
      />
      <ViewsSidebarPreview userId={boot.userId} />
    </div>
  );
}
