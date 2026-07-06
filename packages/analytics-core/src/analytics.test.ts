import { describe, expect, it } from "vitest";
import { CAGR_LONG_WINDOW, CAGR_SHORT_WINDOW, computeInstitutionAnalytics } from "./analytics";
import { type DataPoint } from "./series";

const sticker: readonly DataPoint[] = Array.from({ length: 11 }, (_, i) => ({
  year: 2015 + i,
  value: 40_000 * 1.04 ** i, // ends 2025.
}));

const net: readonly DataPoint[] = Array.from({ length: 11 }, (_, i) => ({
  year: 2015 + i,
  value: 20_000 * 1.03 ** i,
}));

describe("computeInstitutionAnalytics", () => {
  it("exposes the standard 5- and 10-year windows", () => {
    expect(CAGR_SHORT_WINDOW).toBe(5);
    expect(CAGR_LONG_WINDOW).toBe(10);
  });

  it("composes every headline metric from full history", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: sticker,
      netSeries: net,
      projectionTargetYear: 2030,
    });

    expect(analytics.latestSticker.status).toBe("ok");
    expect(analytics.latestNet.status).toBe("ok");
    expect(analytics.discount.status).toBe("ok");
    expect(analytics.cagr5yr.status).toBe("ok");
    expect(analytics.cagr10yr.status).toBe("ok");
    expect(analytics.yoy.status).toBe("ok");
    expect(analytics.projection.status).toBe("ok");

    if (analytics.cagr5yr.status === "ok") {
      expect(analytics.cagr5yr.value.years).toBe(5);
    }
    if (analytics.cagr10yr.status === "ok") {
      expect(analytics.cagr10yr.value.years).toBe(10);
    }
    if (analytics.discount.status === "ok") {
      expect(analytics.discount.value.aid).toBeGreaterThan(0);
    }
  });

  it("degrades only the affected metrics when net-price history is absent", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: sticker,
      netSeries: [],
      projectionTargetYear: 2030,
    });

    // Sticker-derived metrics survive intact...
    expect(analytics.latestSticker.status).toBe("ok");
    expect(analytics.cagr5yr.status).toBe("ok");
    expect(analytics.projection.status).toBe("ok");
    // ...only the net-dependent ones report insufficient data.
    expect(analytics.latestNet.status).toBe("insufficient_data");
    expect(analytics.discount.status).toBe("insufficient_data");
  });

  it("returns fully-typed insufficient states for an institution with one data point", () => {
    const analytics = computeInstitutionAnalytics({
      stickerSeries: [{ year: 2025, value: 40_000 }],
      netSeries: [{ year: 2025, value: 20_000 }],
      projectionTargetYear: 2030,
    });

    expect(analytics.latestSticker.status).toBe("ok");
    expect(analytics.discount.status).toBe("ok");
    expect(analytics.cagr5yr.status).toBe("insufficient_data");
    expect(analytics.cagr10yr.status).toBe("insufficient_data");
    expect(analytics.yoy.status).toBe("insufficient_data");
    expect(analytics.projection.status).toBe("insufficient_data");
  });
});
