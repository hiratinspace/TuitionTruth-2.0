import { computeInstitutionAnalytics, type DataPoint } from "@tuitiontruth/analytics-core";
import { describe, expect, it } from "vitest";
import { toSnapshotRow } from "./serialize";

const sticker: readonly DataPoint[] = Array.from({ length: 11 }, (_, i) => ({
  year: 2015 + i,
  value: 40_000 * 1.04 ** i,
}));
const net: readonly DataPoint[] = Array.from({ length: 11 }, (_, i) => ({
  year: 2015 + i,
  value: 20_000 * 1.03 ** i,
}));

describe("toSnapshotRow", () => {
  it("projects a full analytics object onto scalar columns and payload", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: sticker,
      netSeries: net,
      projectionTargetYear: 2035,
    });
    const row = toSnapshotRow(7, "in_state", 2025, analytics, {
      stickerSeries: sticker,
      netSeries: net,
    });

    expect(row.institutionId).toBe(7);
    expect(row.residencyStatus).toBe("in_state");
    expect(row.latestYear).toBe(2025);
    // Money columns are fixed-2 strings.
    expect(row.latestSticker).toMatch(/^\d+\.\d{2}$/);
    // Rate columns are fixed-6 strings near 4%.
    expect(row.cagr5yr).not.toBeNull();
    expect(Number(row.cagr5yr)).toBeCloseTo(0.04, 4);
    expect(row.projectionYear).toBe(2035);
    // The payload preserves the full Metric union.
    expect(row.payload.cagr5yr.status).toBe("ok");
  });

  it("maps insufficient-data metrics to NULL scalar columns, never 0", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: [{ year: 2025, value: 40_000 }],
      netSeries: [],
      projectionTargetYear: 2030,
    });
    const row = toSnapshotRow(9, "out_of_state", 2025, analytics, {
      stickerSeries: [{ year: 2025, value: 40_000 }],
      netSeries: [],
    });

    expect(row.latestSticker).toBe("40000.00");
    expect(row.latestNet).toBeNull();
    expect(row.cagr5yr).toBeNull();
    expect(row.cagr10yr).toBeNull();
    expect(row.yoyRate).toBeNull();
    expect(row.projectionValue).toBeNull();
    expect(row.projectionYear).toBeNull();
    expect(row.payload.cagr5yr.status).toBe("insufficient_data");
  });

  it("carries a null latestYear through for an institution with no history", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: [],
      netSeries: [],
      projectionTargetYear: 2030,
    });
    const row = toSnapshotRow(3, "in_state", null, analytics, {
      stickerSeries: [],
      netSeries: [],
    });
    expect(row.latestYear).toBeNull();
    expect(row.latestSticker).toBeNull();
  });
});
