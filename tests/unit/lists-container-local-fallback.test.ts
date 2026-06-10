import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function usesLocalFallback(args: {
  viewsDefined: boolean;
  viewsError: boolean;
  viewsFailureCount: number;
  localBootReady: boolean;
}) {
  const apiUnavailable =
    (args.viewsError || args.viewsFailureCount > 0) &&
    !args.viewsDefined;
  return apiUnavailable && args.localBootReady;
}

describe("ListsContainer local fallback gate", () => {
  it("stays inert during ordinary loading", () => {
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: false,
        viewsFailureCount: 0,
        localBootReady: true,
      }),
    ).toBe(false);
  });

  it("stays inert online regardless of failure count", () => {
    expect(
      usesLocalFallback({
        viewsDefined: true,
        viewsError: false,
        viewsFailureCount: 0,
        localBootReady: true,
      }),
    ).toBe(false);
    expect(
      usesLocalFallback({
        viewsDefined: true,
        viewsError: true,
        viewsFailureCount: 2,
        localBootReady: true,
      }),
    ).toBe(false);
  });

  it("activates on the first failed attempt with no server data", () => {
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: false,
        viewsFailureCount: 1,
        localBootReady: true,
      }),
    ).toBe(true);
  });

  it("activates on isError with no server data", () => {
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: true,
        viewsFailureCount: 0,
        localBootReady: true,
      }),
    ).toBe(true);
    expect(
      usesLocalFallback({
        viewsDefined: false,
        viewsError: true,
        viewsFailureCount: 1,
        localBootReady: false,
      }),
    ).toBe(false);
  });

  it("keeps the component wired to the confirmed-unavailable expression", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/list/ListsContainer.tsx"),
      "utf8",
    );

    expect(source).toMatch(
      /const apiUnavailable = \(viewsError \|\| viewsFailureCount > 0\) && !views;/,
    );
    expect(source).toMatch(
      /const usingLocalFallback = apiUnavailable && boot\.localBootReady;/,
    );
    expect(source).toMatch(
      /localCurrentView: usingLocalFallback \? boot\.localCurrentView : undefined/,
    );
  });
});
