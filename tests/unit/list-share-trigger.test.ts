import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("list share trigger", () => {
  it("uses an accessible UserRoundPlus icon button", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "components/list/ListComponent.tsx"),
      "utf8",
    );

    expect(source).toContain("UserRoundPlus");
    expect(source).toContain('aria-label={`Share ${list.name}`}');
    expect(source).toContain('title="Share list"');
    expect(source).not.toContain('<span className="text-xs">Share</span>');
  });
});
