import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function usesLocalFallback(args: {
  viewsDefined: boolean;
  viewsError: boolean;
  localBootReady: boolean;
}) {
  const apiUnavailable = args.viewsError && !args.viewsDefined;
  return apiUnavailable && args.localBootReady;
}

describe("ListsContainer local fallback gate", () => {
  it("stays inert with server data and during ordinary loading", () => {
    expect(
      usesLocalFallback({
        viewsDefined: true,
        viewsError: true,
        localBootReady: true,
      }),
    ).toBe(false);
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: false,
        localBootReady: true,
      }),
    ).toBe(false);
  });

  it("activates only after the views query errors with no data", () => {
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: true,
        localBootReady: true,
      }),
    ).toBe(true);
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: true,
        localBootReady: false,
      }),
    ).toBe(false);
  });

  it("keeps the component wired to the confirmed-unavailable expression", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/list/ListsContainer.tsx"),
      "utf8",
    );

    expect(source).toMatch(/const apiUnavailable = viewsError && !views;/);
    expect(source).toMatch(
      /const usingLocalFallback = apiUnavailable && boot\.localBootReady;/,
    );
    expect(source).toMatch(
      /localCurrentView: usingLocalFallback \? boot\.localCurrentView : undefined/,
    );
  });
});
