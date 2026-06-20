import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REQUIRED_COLOR_ROLES } from "@/lib/theme/tokens";

function readThemeBlock(css: string, selector: string) {
  const escapedSelector = selector.replace(".", "\\.");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));

  expect(match, `${selector} theme block is missing`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("semantic theme tokens", () => {
  it("defines every required color role in light and dark themes", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const lightTheme = readThemeBlock(css, ":root");
    const darkTheme = readThemeBlock(css, ".dark");

    for (const role of REQUIRED_COLOR_ROLES) {
      const declaration = new RegExp(`--${role}\\s*:`);

      expect(lightTheme, `light theme is missing --${role}`).toMatch(declaration);
      expect(darkTheme, `dark theme is missing --${role}`).toMatch(declaration);
    }
  });
});
