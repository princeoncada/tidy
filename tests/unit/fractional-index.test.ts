import { describe, expect, it } from "vitest";

import {
  initialKeys,
  keyBetween,
  keysBetween,
} from "@/lib/sync/fractional-index";

describe("fractional order keys", () => {
  it("generates stable ascending initial keys", () => {
    const keys = initialKeys(4);

    expect(keys).toHaveLength(4);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("generates keys before, between, and after existing keys", () => {
    const [first, second] = initialKeys(2);
    const between = keyBetween(first, second);

    expect(keyBetween(null, first) < first).toBe(true);
    expect(first < between && between < second).toBe(true);
    expect(keyBetween(second, null) > second).toBe(true);
  });

  it("generates multiple ordered keys inside one interval", () => {
    const [first, second] = initialKeys(2);
    const generated = keysBetween(first, second, 3);

    expect(generated).toHaveLength(3);
    expect([...generated].sort()).toEqual(generated);
    expect(generated.every((key) => first < key && key < second)).toBe(true);
  });
});
