import { describe, expect, it } from "vitest";
import { netPriceGap } from "./net-price";

describe("netPriceGap", () => {
  it("computes aid and discount rate", () => {
    const result = netPriceGap(62_484, 18_279);
    expect(result).toMatchObject({ status: "ok" });
    if (result.status === "ok") {
      expect(result.value.aid).toBe(44_205);
      expect(result.value.discountRate).toBeCloseTo(0.7075, 3);
    }
  });

  it("permits a net figure above sticker (negative aid) and surfaces it honestly", () => {
    const result = netPriceGap(20_000, 25_000);
    expect(result).toMatchObject({ status: "ok" });
    if (result.status === "ok") {
      expect(result.value.aid).toBe(-5_000);
      expect(result.value.discountRate).toBeCloseTo(-0.25, 10);
    }
  });

  it("treats a zero-aid institution as a full-sticker net price", () => {
    const result = netPriceGap(30_000, 30_000);
    if (result.status === "ok") {
      expect(result.value.aid).toBe(0);
      expect(result.value.discountRate).toBe(0);
    }
  });

  it("rejects a non-positive sticker price", () => {
    expect(netPriceGap(0, 0)).toEqual({
      status: "insufficient_data",
      reason: "sticker price must be positive to compute a discount",
    });
  });

  it("rejects a negative net price", () => {
    expect(netPriceGap(30_000, -1)).toEqual({
      status: "insufficient_data",
      reason: "net price cannot be negative",
    });
  });
});
