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
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const [collapsed, setCollapsed] = useState(false);

  const collapseLabel = collapsed ? "Expand navigation" : "Collapse navigation";

  return (
    <div className="relative flex h-dvh w-full min-w-0 overflow-hidden bg-canvas text-text">
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
          <div className="flex h-14 shrink-0 items-center justify-end px-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={collapseLabel}
              title={collapseLabel}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
              className="active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>

          <nav
            aria-label="Views"
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
              Switch between your saved views.
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
              aria-label="Views"
              className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
            >
              {sidebar}
            </nav>
          </DialogContent>
        </Dialog>
      )}

      {children}
    </div>
  );
}
