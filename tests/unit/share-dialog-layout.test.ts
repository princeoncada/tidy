import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("share dialog layout", () => {
  it("keeps the share dialog compact at desktop widths", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "components/sharing/ShareDialog.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'className="max-h-[85vh] w-[min(32rem,calc(100%-2rem))] max-w-none overflow-y-auto sm:max-w-none"',
    );
    expect(source).not.toContain("sm:max-w-lg");
  });
});
