import { describe, expect, it } from "vitest";
import {
  axisTicks,
  buildLineSegments,
  linearScale,
  padDomain,
  scalePoints,
  valueDomain,
  yearDomain,
  type ChartPoint,
  type PlotArea,
} from "./geometry";

const plot: PlotArea = {
  width: 100,
  height: 100,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe("padDomain", () => {
  it("widens a normal domain by the ratio", () => {
    expect(padDomain([100, 200], 0.1)).toEqual([90, 210]);
  });
  it("clamps the floor at zero", () => {
    expect(padDomain([5, 100], 1)).toEqual([0, 195]);
  });
  it("widens a degenerate non-zero domain symmetrically", () => {
    expect(padDomain([50, 50])).toEqual([45, 55]);
  });
  it("widens a degenerate zero domain", () => {
    expect(padDomain([0, 0])).toEqual([0, 1]);
  });
});

describe("yearDomain / valueDomain", () => {
  const points: ChartPoint[] = [
    { year: 2020, value: 300 },
    { year: 2022, value: 100 },
    { year: 2021, value: 200 },
  ];
  it("finds the year extent", () => {
    expect(yearDomain(points)).toEqual([2020, 2022]);
  });
  it("finds the value extent", () => {
    expect(valueDomain(points)).toEqual([100, 300]);
  });
  it("returns null for empty series", () => {
    expect(yearDomain([])).toBeNull();
    expect(valueDomain([])).toBeNull();
  });
});

describe("linearScale", () => {
  it("maps a domain onto a range", () => {
    const scale = linearScale([0, 10], 0, 100);
    expect(scale(0)).toBe(0);
    expect(scale(5)).toBe(50);
    expect(scale(10)).toBe(100);
  });
  it("collapses a flat domain onto the low end", () => {
    const scale = linearScale([5, 5], 0, 100);
    expect(scale(5)).toBe(0);
  });
});

describe("scalePoints", () => {
  it("inverts the y axis (higher value → smaller pixel-y)", () => {
    const scaled = scalePoints(
      [
        { year: 2020, value: 0 },
        { year: 2021, value: 100 },
      ],
      [2020, 2021],
      [0, 100],
      plot,
    );
    expect(scaled[0]).toMatchObject({ x: 0, y: 100 });
    expect(scaled[1]).toMatchObject({ x: 100, y: 0 });
  });
});

describe("buildLineSegments", () => {
  it("returns no segments for fewer than two points", () => {
    expect(buildLineSegments([{ year: 2020, value: 1, x: 0, y: 0 }])).toEqual([]);
  });
  it("tags consecutive years solid and year jumps as gaps", () => {
    const segments = buildLineSegments([
      { year: 2020, value: 1, x: 0, y: 10 },
      { year: 2021, value: 2, x: 10, y: 8 },
      { year: 2024, value: 3, x: 40, y: 4 },
    ]);
    expect(segments.map((s) => s.kind)).toEqual(["solid", "gap"]);
    expect(segments[0]?.d).toBe("M 0 10 L 10 8");
  });
});

describe("axisTicks", () => {
  it("produces count+1 inclusive ticks", () => {
    expect(axisTicks([0, 100], 4)).toEqual([0, 25, 50, 75, 100]);
  });
  it("returns a single tick for a flat domain", () => {
    expect(axisTicks([50, 50], 4)).toEqual([50]);
  });
  it("returns a single tick for a non-positive count", () => {
    expect(axisTicks([0, 100], 0)).toEqual([0]);
  });
});
