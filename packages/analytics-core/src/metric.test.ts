import { describe, expect, it } from "vitest";
import { combineMetrics, insufficient, isOk, mapMetric, ok, unwrapOr, type Metric } from "./metric";

describe("Metric primitive", () => {
  it("constructs an ok metric carrying its value", () => {
    const metric = ok(42);
    expect(metric).toEqual({ status: "ok", value: 42 });
  });

  it("constructs an insufficient_data metric carrying its reason", () => {
    const metric = insufficient<number>("no prior-year record");
    expect(metric).toEqual({ status: "insufficient_data", reason: "no prior-year record" });
  });

  it("narrows correctly with isOk", () => {
    const good: Metric<number> = ok(1);
    const bad: Metric<number> = insufficient("gap");
    expect(isOk(good)).toBe(true);
    expect(isOk(bad)).toBe(false);
  });

  it("maps over an ok value", () => {
    const result = mapMetric(ok(10), (n) => n * 2);
    expect(result).toEqual({ status: "ok", value: 20 });
  });

  it("propagates insufficient_data through map without invoking the mapper", () => {
    let called = false;
    const result = mapMetric(insufficient<number>("gap"), (n) => {
      called = true;
      return n * 2;
    });
    expect(called).toBe(false);
    expect(result).toEqual({ status: "insufficient_data", reason: "gap" });
  });

  it("unwraps an ok value", () => {
    expect(unwrapOr(ok(7), -1)).toBe(7);
  });

  it("falls back to the explicit default for insufficient_data", () => {
    expect(unwrapOr(insufficient<number>("gap"), -1)).toBe(-1);
  });

  describe("combineMetrics", () => {
    const add = (a: number, b: number): Metric<number> => ok(a + b);

    it("applies the combiner when both inputs are ok", () => {
      expect(combineMetrics(ok(3), ok(4), add)).toEqual({ status: "ok", value: 7 });
    });

    it("short-circuits to the first input's reason when it is insufficient", () => {
      let called = false;
      const result = combineMetrics(insufficient<number>("no sticker"), ok(4), (a, b) => {
        called = true;
        return add(a, b);
      });
      expect(called).toBe(false);
      expect(result).toEqual({ status: "insufficient_data", reason: "no sticker" });
    });

    it("short-circuits to the second input's reason when only it is insufficient", () => {
      const result = combineMetrics(ok(3), insufficient<number>("no net"), add);
      expect(result).toEqual({ status: "insufficient_data", reason: "no net" });
    });

    it("propagates an insufficient result produced by the combiner itself", () => {
      const result = combineMetrics(ok(3), ok(4), () => insufficient<number>("combiner said no"));
      expect(result).toEqual({ status: "insufficient_data", reason: "combiner said no" });
    });
  });
});
