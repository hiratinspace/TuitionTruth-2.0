import { describe, expect, it } from "vitest";
import { PROJECTION_INCREMENT, roundToNearest } from "./money";

describe("roundToNearest", () => {
  it("rounds to the nearest increment (down)", () => {
    expect(roundToNearest(73_124, 100)).toBe(73_100);
  });

  it("rounds to the nearest increment (up)", () => {
    expect(roundToNearest(73_180, 100)).toBe(73_200);
  });

  it("rounds a half up (banker-agnostic Math.round)", () => {
    expect(roundToNearest(150, 100)).toBe(200);
  });

  it("leaves an exact multiple unchanged", () => {
    expect(roundToNearest(73_100, 100)).toBe(73_100);
  });

  it("uses the exported projection increment of $100", () => {
    expect(PROJECTION_INCREMENT).toBe(100);
    expect(roundToNearest(62_484, PROJECTION_INCREMENT)).toBe(62_500);
  });

  it("throws on a zero increment", () => {
    expect(() => roundToNearest(100, 0)).toThrow(RangeError);
  });

  it("throws on a negative increment", () => {
    expect(() => roundToNearest(100, -100)).toThrow(/must be positive/);
  });
});
