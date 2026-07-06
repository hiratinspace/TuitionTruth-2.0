import { describe, expect, it } from "vitest";
import { project } from "./projection";
import { type DataPoint } from "./series";

const series: readonly DataPoint[] = Array.from({ length: 6 }, (_, i) => ({
  year: 2020 + i,
  value: 10_000 * 1.04 ** i, // 4%/yr, ending 2025.
}));

describe("project", () => {
  it("extrapolates forward and rounds to the nearest $100", () => {
    const result = project(series, 2030, 5);
    expect(result).toMatchObject({ status: "ok" });
    if (result.status === "ok") {
      // 2025 value ~12,166.53 compounded 5 more years at 4% ≈ 14,803 → rounds to 14,800.
      expect(result.value.projectedValue % 100).toBe(0);
      expect(result.value.projectedValue).toBe(14_800);
      expect(result.value.targetYear).toBe(2030);
      expect(result.value.fromYear).toBe(2025);
      expect(result.value.method).toBe("cagr_extrapolation");
      expect(result.value.roundedToNearest).toBe(100);
    }
  });

  it("attaches a human-readable methodology label with no false precision", () => {
    const result = project(series, 2030, 5);
    if (result.status === "ok") {
      expect(result.value.methodology).toContain("CAGR");
      expect(result.value.methodology).toContain("2025");
      expect(result.value.methodology).toContain("nearest $100");
    }
  });

  it("propagates insufficient data when history is too short for the window", () => {
    const single: readonly DataPoint[] = [{ year: 2025, value: 10_000 }];
    expect(project(single, 2030, 5)).toEqual({
      status: "insufficient_data",
      reason: "no comparison year within 5 years before 2025",
    });
  });

  it("rejects a target year at or before the latest observed year", () => {
    expect(project(series, 2025, 5)).toEqual({
      status: "insufficient_data",
      reason: "projection target 2025 must be after the latest observed year 2025",
    });
  });
});
