import { describe, expect, it } from "vitest";
import { yoyForLatest } from "./yoy";
import { type DataPoint } from "./series";

describe("yoyForLatest", () => {
  it("computes the year-over-year change for the latest year", () => {
    const series: readonly DataPoint[] = [
      { year: 2023, value: 10_000 },
      { year: 2024, value: 10_320 },
    ];
    expect(yoyForLatest(series)).toEqual({
      status: "ok",
      value: {
        rate: 0.032,
        delta: 320,
        fromYear: 2023,
        toYear: 2024,
        fromValue: 10_000,
        toValue: 10_320,
      },
    });
  });

  it("handles a year-over-year decrease", () => {
    const series: readonly DataPoint[] = [
      { year: 2023, value: 10_000 },
      { year: 2024, value: 9_500 },
    ];
    const result = yoyForLatest(series);
    expect(result).toMatchObject({ status: "ok" });
    if (result.status === "ok") {
      expect(result.value.rate).toBeCloseTo(-0.05, 10);
      expect(result.value.delta).toBe(-500);
    }
  });

  it("reports insufficient data for an empty series", () => {
    expect(yoyForLatest([])).toEqual({
      status: "insufficient_data",
      reason: "no observations available",
    });
  });

  it("reports insufficient data when the immediately prior year is missing", () => {
    const gapped: readonly DataPoint[] = [
      { year: 2022, value: 9_000 },
      { year: 2024, value: 10_000 },
    ];
    expect(yoyForLatest(gapped)).toEqual({
      status: "insufficient_data",
      reason: "no 2023 observation; year-over-year needs consecutive years",
    });
  });

  it("reports insufficient data for a non-positive prior-year base", () => {
    const series: readonly DataPoint[] = [
      { year: 2023, value: 0 },
      { year: 2024, value: 10_000 },
    ];
    expect(yoyForLatest(series)).toEqual({
      status: "insufficient_data",
      reason: "prior-year base value must be positive",
    });
  });
});
