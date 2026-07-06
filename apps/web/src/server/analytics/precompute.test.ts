import { describe, expect, it } from "vitest";
import { latestYearOf, projectionTargetYear, rowsToSeries } from "./precompute";

interface Row {
  readonly academicYear: number;
  readonly amount: string | null;
}

describe("rowsToSeries", () => {
  it("maps numeric-string rows into a value-space series", () => {
    const rows: Row[] = [
      { academicYear: 2023, amount: "10000.00" },
      { academicYear: 2024, amount: "10320.50" },
    ];
    expect(
      rowsToSeries(
        rows,
        (r) => r.academicYear,
        (r) => r.amount,
      ),
    ).toEqual([
      { year: 2023, value: 10_000 },
      { year: 2024, value: 10_320.5 },
    ]);
  });

  it("drops rows whose amount is null (no silent zero)", () => {
    const rows: Row[] = [
      { academicYear: 2023, amount: null },
      { academicYear: 2024, amount: "10000.00" },
    ];
    const series = rowsToSeries(
      rows,
      (r) => r.academicYear,
      (r) => r.amount,
    );
    expect(series).toEqual([{ year: 2024, value: 10_000 }]);
  });

  it("drops rows whose amount is unparseable", () => {
    const rows: Row[] = [{ academicYear: 2023, amount: "not-a-number" }];
    expect(
      rowsToSeries(
        rows,
        (r) => r.academicYear,
        (r) => r.amount,
      ),
    ).toEqual([]);
  });
});

describe("latestYearOf", () => {
  it("returns the max year", () => {
    expect(
      latestYearOf([
        { year: 2020, value: 1 },
        { year: 2024, value: 2 },
        { year: 2022, value: 3 },
      ]),
    ).toBe(2024);
  });

  it("returns null for an empty series", () => {
    expect(latestYearOf([])).toBeNull();
  });
});

describe("projectionTargetYear", () => {
  it("targets a fixed long-window horizon ahead of the latest year", () => {
    expect(projectionTargetYear(2025)).toBe(2035);
  });
});
