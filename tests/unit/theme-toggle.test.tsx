import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    document.documentElement.className = "";
    window.localStorage.clear();
  });

  it("exposes an accessible control and activates the next theme", async () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey="theme-toggle-test">
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", {
      name: "Theme: light. Switch to dark",
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(toggle).toHaveAccessibleName("Theme: dark. Switch to system");
    });
  });
});
