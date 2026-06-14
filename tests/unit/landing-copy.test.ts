import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");

describe("landing page copy", () => {
  it("uses Tidy branding in the title", () => {
    expect(source).toContain("<CardTitle>Tidy</CardTitle>");
  });

  it("has no spelling typo in the description", () => {
    expect(source).not.toContain("optimisic");
    expect(source).toContain("optimistic updates");
  });

  it("drops the placeholder app name", () => {
    expect(source).not.toContain("Simple Todo App");
  });
});
