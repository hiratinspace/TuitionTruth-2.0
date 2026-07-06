import { describe, expect, it } from "vitest";
import { cagrForWindow, computeCagr } from "./cagr";
import { isOk, type Metric } from "./metric";
import { type DataPoint } from "./series";

function expectOk<T>(metric: Metric<T>): T {
  if (!isOk(metric)) {
    throw new Error(`expected ok, got insufficient_data: ${metric.reason}`);
  }
  return metric.value;
}

describe("computeCagr", () => {
  it("computes a positive growth rate", () => {
    // 100 → 121 over 2 years = 10%/yr.
    const rate = expectOk(computeCagr(100, 121, 2));
    expect(rate).toBeCloseTo(0.1, 10);
  });

  it("computes a negative growth rate for a decline", () => {
    const rate = expectOk(computeCagr(100, 81, 2));
    expect(rate).toBeCloseTo(-0.1, 10);
  });

  it("computes a simple one-year rate", () => {
    expect(expectOk(computeCagr(100, 103, 1))).toBeCloseTo(0.03, 10);
  });

  it("rejects a sub-annual span", () => {
    expect(computeCagr(100, 121, 0)).toEqual({
      status: "insufficient_data",
      reason: "CAGR needs a span of at least one year",
    });
  });

  it("rejects a non-positive base value", () => {
    expect(computeCagr(0, 121, 2)).toEqual({
      status: "insufficient_data",
      reason: "CAGR base value must be positive",
    });
  });

  it("rejects a non-positive end value", () => {
    expect(computeCagr(100, 0, 2)).toEqual({
      status: "insufficient_data",
      reason: "CAGR end value must be positive",
    });
  });
});

describe("cagrForWindow", () => {
  const tenYears: readonly DataPoint[] = Array.from({ length: 11 }, (_, i) => ({
    year: 2015 + i,
    // 4%/yr compounding from 10,000.
    value: 10_000 * 1.04 ** i,
  }));

  it("computes CAGR over a 5-year window anchored on the latest year", () => {
    const result = expectOk(cagrForWindow(tenYears, 5));
    expect(result.rate).toBeCloseTo(0.04, 6);
    expect(result.startYear).toBe(2020);
    expect(result.endYear).toBe(2025);
    expect(result.years).toBe(5);
  });

  it("computes CAGR over a 10-year window", () => {
    const result = expectOk(cagrForWindow(tenYears, 10));
    expect(result.startYear).toBe(2015);
    expect(result.endYear).toBe(2025);
    expect(result.years).toBe(10);
  });

  it("uses the real span when a year inside the window is missing", () => {
    // Window asks for 5 years, but the earliest point in range is only 4 back.
    const sparse: readonly DataPoint[] = [
      { year: 2021, value: 10_000 },
      { year: 2025, value: 12_000 },
    ];
    const result = expectOk(cagrForWindow(sparse, 5));
    expect(result.startYear).toBe(2021);
    expect(result.years).toBe(4);
  });

  it("ignores observations older than the window", () => {
    const withOld: readonly DataPoint[] = [
      { year: 2000, value: 1 },
      { year: 2023, value: 10_000 },
      { year: 2025, value: 11_000 },
    ];
    const result = expectOk(cagrForWindow(withOld, 5));
    expect(result.startYear).toBe(2023);
  });

  it("rejects a window shorter than a year", () => {
    expect(cagrForWindow(tenYears, 0)).toEqual({
      status: "insufficient_data",
      reason: "CAGR window must be at least one year",
    });
  });

  it("reports insufficient data for an empty series", () => {
    expect(cagrForWindow([], 5)).toEqual({
      status: "insufficient_data",
      reason: "no observations available",
    });
  });

  it("reports insufficient data when only one observation sits in the window", () => {
    const single: readonly DataPoint[] = [{ year: 2025, value: 10_000 }];
    expect(cagrForWindow(single, 5)).toEqual({
      status: "insufficient_data",
      reason: "no comparison year within 5 years before 2025",
    });
  });

  it("propagates the insufficient reason from the underlying CAGR", () => {
    const nonPositiveBase: readonly DataPoint[] = [
      { year: 2021, value: -5 },
      { year: 2025, value: 10_000 },
    ];
    expect(cagrForWindow(nonPositiveBase, 5)).toEqual({
      status: "insufficient_data",
      reason: "CAGR base value must be positive",
    });
  });
});
