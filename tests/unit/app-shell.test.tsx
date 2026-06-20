import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";

function setDesktopViewport(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1024px)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function StableCanvas({ onMount }: { onMount: () => void }) {
  const nodeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    onMount();
  }, [onMount]);

  return (
    <main ref={nodeRef} data-testid="stable-canvas">
      Canvas
    </main>
  );
}

describe("AppShell", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collapses and expands without remounting the canvas", () => {
    setDesktopViewport(true);
    const onMount = vi.fn();

    render(
      <AppShell sidebar={<div>Views</div>}>
        <StableCanvas onMount={onMount} />
      </AppShell>,
    );

    const canvas = screen.getByTestId("stable-canvas");
    const collapse = screen.getByRole("button", { name: "Collapse navigation" });

    fireEvent.click(collapse);
    expect(
      screen.getByRole("button", { name: "Expand navigation" }),
    ).toBeVisible();
    expect(screen.getByTestId("stable-canvas")).toBe(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(
      screen.getByRole("button", { name: "Collapse navigation" }),
    ).toBeVisible();
    expect(screen.getByTestId("stable-canvas")).toBe(canvas);
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("names the mobile drawer trigger and returns focus after close", async () => {
    setDesktopViewport(false);

    render(
      <AppShell sidebar={<button type="button">All Lists</button>}>
        <main>Canvas</main>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation menu" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: "Dashboard navigation" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close navigation menu" }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
