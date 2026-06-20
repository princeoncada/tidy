"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const THEME_ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const currentTheme = THEME_ORDER.includes(
    theme as (typeof THEME_ORDER)[number],
  )
    ? (theme as (typeof THEME_ORDER)[number])
    : "system";
  const nextTheme = currentTheme === "light"
    ? "dark"
    : currentTheme === "dark"
      ? "system"
      : "light";
  const Icon = !mounted
    ? Monitor
    : currentTheme === "light"
      ? Sun
      : currentTheme === "dark"
        ? Moon
        : Monitor;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start text-xs focus-visible:ring-focus"
      aria-label={`Theme: ${currentTheme}. Switch to ${nextTheme}`}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon aria-hidden="true" />
      Theme: {mounted ? currentTheme : "system"}
    </Button>
  );
}
