import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function referencedAssets(relSourcePath: string): string[] {
  const source = readFileSync(path.join(root, relSourcePath), "utf8");
  const matches = source.match(/["'`]\/[^"'`]+\.(?:png|ico|svg|webmanifest)["'`]/g) ?? [];
  return matches.map((m) => m.slice(2, -1));
}

function assetExists(assetPath: string): boolean {
  return (
    existsSync(path.join(root, "public", assetPath)) ||
    existsSync(path.join(root, "app", assetPath))
  );
}

describe("metadata asset references", () => {
  const sources = ["app/layout.tsx", "app/manifest.ts"];

  for (const source of sources) {
    it(`only references existing local assets in ${source}`, () => {
      const assets = referencedAssets(source);
      const missing = assets.filter((asset) => !assetExists(asset));
      expect(missing).toEqual([]);
    });
  }

  it("does not reference the retired apple-icon.png asset", () => {
    const all = [
      ...referencedAssets("app/layout.tsx"),
      ...referencedAssets("app/manifest.ts"),
    ];
    expect(all).not.toContain("apple-icon.png");
  });
});
