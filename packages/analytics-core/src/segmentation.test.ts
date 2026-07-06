import { describe, expect, it } from "vitest";
import { segmentStats } from "./segmentation";

describe("segmentStats", () => {
  it("computes distribution stats for an odd-length segment", () => {
    const result = segmentStats([30_000, 10_000, 20_000]);
    expect(result).toEqual({
      status: "ok",
      value: { count: 3, mean: 20_000, median: 20_000, min: 10_000, max: 30_000 },
    });
  });

  it("averages the two central values for an even-length segment", () => {
    const result = segmentStats([10_000, 20_000, 30_000, 40_000]);
    if (result.status === "ok") {
      expect(result.value.median).toBe(25_000);
      expect(result.value.mean).toBe(25_000);
      expect(result.value.count).toBe(4);
    }
  });

  it("handles a single-value segment", () => {
    const result = segmentStats([42_000]);
    expect(result).toEqual({
      status: "ok",
      value: { count: 1, mean: 42_000, median: 42_000, min: 42_000, max: 42_000 },
    });
  });

  it("reports the median honestly for a right-skewed distribution", () => {
    // Mean is dragged up by the outlier; median stays representative.
    const result = segmentStats([10_000, 11_000, 12_000, 13_000, 90_000]);
    if (result.status === "ok") {
      expect(result.value.median).toBe(12_000);
      expect(result.value.mean).toBe(27_200);
    }
  });

  it("reports insufficient data for an empty segment", () => {
    expect(segmentStats([])).toEqual({
      status: "insufficient_data",
      reason: "segment contains no institutions with data",
    });
  });
});
