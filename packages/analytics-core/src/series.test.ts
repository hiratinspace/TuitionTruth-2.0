import { describe, expect, it } from "vitest";
import { findByYear, latestValue, sortByYear, type DataPoint } from "./series";

const unordered: readonly DataPoint[] = [
  { year: 2022, value: 200 },
  { year: 2020, value: 100 },
  { year: 2021, value: 150 },
];

describe("sortByYear", () => {
  it("orders observations oldest year first", () => {
    expect(sortByYear(unordered).map((p) => p.year)).toEqual([2020, 2021, 2022]);
  });

  it("does not mutate the input array", () => {
    const input = [...unordered];
    sortByYear(input);
    expect(input.map((p) => p.year)).toEqual([2022, 2020, 2021]);
  });

  it("handles an empty series", () => {
    expect(sortByYear([])).toEqual([]);
  });
});

describe("findByYear", () => {
  it("returns the matching observation", () => {
    expect(findByYear(unordered, 2021)).toEqual({ year: 2021, value: 150 });
  });

  it("returns undefined for a missing year", () => {
    expect(findByYear(unordered, 2019)).toBeUndefined();
  });
});

describe("latestValue", () => {
  it("returns the most recent value", () => {
    expect(latestValue(unordered)).toEqual({ status: "ok", value: 200 });
  });

  it("reports insufficient data for an empty series", () => {
    expect(latestValue([])).toEqual({
      status: "insufficient_data",
      reason: "no observations available",
    });
  });
});
