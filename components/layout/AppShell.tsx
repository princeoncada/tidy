"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktopQuery(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => undefined;
  }

  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getDesktopSnapshot() {
  return typeof window !== "undefined" &&
    Boolean(window.matchMedia?.(DESKTOP_QUERY).matches);
}

function getServerDesktopSnapshot() {
  return false;
}

type AppShellProps = {
  sidebar: ReactNode;
  footer?: (context: {
    collapsed: boolean;
    requestExpand: () => void;
  }) => ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, footer, children }: AppShellProps) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const [collapsed, setCollapsed] = useState(false);
  const requestExpand = () => setCollapsed(false);

  const collapseLabel = collapsed ? "Expand navigation" : "Collapse navigation";

  return (
    <div className="relative flex h-dvh w-full min-w-0 overflow-hidden bg-canvas text-text">
      {isDesktop && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="sidebar-collapse-toggle"
          aria-label={collapseLabel}
          title={collapseLabel}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
          className="absolute left-2 top-2 z-20 active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      )}
      {isDesktop ? (
        <aside
          aria-label="Dashboard navigation"
          data-collapsed={collapsed}
          className={cn(
            "relative z-10 flex h-dvh shrink-0 flex-col overflow-hidden border-r border-border bg-surface",
            "transition-[width] duration-200 ease-out motion-reduce:transition-none",
            collapsed ? "w-14" : "w-64",
          )}
        >
          <div className="h-14 shrink-0" />

          <nav
            aria-label="Sidebar navigation"
            aria-hidden={collapsed}
            className={cn(
              "w-64 flex-1 overflow-y-auto px-2 pb-4 transition-opacity duration-150 motion-reduce:transition-none",
              collapsed
                ? "pointer-events-none invisible opacity-0"
                : "visible opacity-100",
            )}
          >
            {sidebar}
          </nav>
          {footer && (
            <div className="shrink-0 overflow-hidden">
              <div
                className={cn(
                  "flex py-2",
                  collapsed ? "w-14 justify-center px-0" : "w-64 px-2",
                )}
              >
                {footer({ collapsed, requestExpand })}
              </div>
              <Separator />
            </div>
          )}
        </aside>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open navigation menu"
              title="Open navigation menu"
              className="absolute left-2 top-2 z-20 bg-surface active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Menu />
            </Button>
          </DialogTrigger>

          <DialogContent
            showCloseButton={false}
            overlayClassName="bg-overlay motion-reduce:animate-none"
            className={cn(
              "left-0 top-0 h-dvh w-64 max-w-[calc(100vw-2rem)] translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 border-r border-border p-0",
              "data-open:slide-in-from-left data-closed:slide-out-to-left motion-reduce:animate-none",
            )}
          >
            <DialogTitle className="sr-only">Dashboard navigation</DialogTitle>
            <DialogDescription className="sr-only">
              Create lists and switch between workspaces or saved views.
            </DialogDescription>
            <div className="flex h-14 shrink-0 items-center justify-end px-3">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation menu"
                  title="Close navigation menu"
                  className="active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <X />
                </Button>
              </DialogClose>
            </div>
            <nav
              aria-label="Sidebar navigation"
              className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
            >
              {sidebar}
            </nav>
            {footer && (
              <div className="shrink-0">
                <div className="px-2 py-2">
                  {footer({ collapsed: false, requestExpand })}
                </div>
                <Separator />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {children}
    </div>
  );
}
