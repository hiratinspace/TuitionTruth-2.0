import { describe, expect, it } from "vitest";
import { clamp01, countUpValue, easeOutCubic } from "./easing";

describe("clamp01", () => {
  it("clamps below 0 and above 1 and passes through the middle", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe("easeOutCubic", () => {
  it("anchors at 0 and 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("is ahead of linear at the midpoint (fast start)", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it("clamps out-of-range input", () => {
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
  });
});

describe("countUpValue", () => {
  it("starts at 0 and ends exactly at target", () => {
    expect(countUpValue(1000, 0, 300)).toBe(0);
    expect(countUpValue(1000, 300, 300)).toBe(1000);
  });
  it("snaps to target once elapsed exceeds the duration", () => {
    expect(countUpValue(1000, 400, 300)).toBe(1000);
  });
  it("returns target immediately for a zero duration", () => {
    expect(countUpValue(1000, 0, 0)).toBe(1000);
  });
  it("is between 0 and target mid-animation", () => {
    const mid = countUpValue(1000, 150, 300);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
  });
});
