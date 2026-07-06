import { describe, expect, it } from "vitest";
import {
  directionOf,
  formatAcademicYear,
  formatCurrency,
  formatCurrencyCents,
  formatPercent,
  formatYearRange,
} from "./format";

describe("formatCurrency", () => {
  it("formats whole dollars with a group separator", () => {
    expect(formatCurrency(62_484)).toBe("$62,484");
  });
  it("rounds to whole dollars", () => {
    expect(formatCurrency(18_279.62)).toBe("$18,280");
  });
});

describe("formatCurrencyCents", () => {
  it("keeps two decimal places", () => {
    expect(formatCurrencyCents(1234.5)).toBe("$1,234.50");
  });
});

describe("formatPercent", () => {
  it("prefixes a positive rate with +", () => {
    expect(formatPercent(0.039)).toBe("+3.9%");
  });
  it("uses a true minus glyph for a negative rate", () => {
    expect(formatPercent(-0.012)).toBe("−1.2%");
  });
  it("renders an unsigned zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
  it("treats a value that rounds to zero as unsigned zero", () => {
    expect(formatPercent(0.0001)).toBe("0.0%");
  });
  it("honours a custom precision", () => {
    expect(formatPercent(0.03949, 2)).toBe("+3.95%");
  });
});

describe("formatAcademicYear", () => {
  it("renders the two-year label", () => {
    expect(formatAcademicYear(2024)).toBe("2024–25");
  });
  it("pads the century rollover", () => {
    expect(formatAcademicYear(2009)).toBe("2009–10");
  });
});

describe("formatYearRange", () => {
  it("renders an inclusive span", () => {
    expect(formatYearRange(2011, 2026)).toBe("2011 – 2026");
  });
});

describe("directionOf", () => {
  it("classifies a clear increase as rising", () => {
    expect(directionOf(0.03)).toBe("rising");
  });
  it("classifies a clear decrease as falling", () => {
    expect(directionOf(-0.03)).toBe("falling");
  });
  it("treats a negligible move as flat", () => {
    expect(directionOf(0.0001)).toBe("flat");
    expect(directionOf(0)).toBe("flat");
  });
});
