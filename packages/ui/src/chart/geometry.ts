/**
 * Pure chart geometry — no React, no DOM. Turns a tuition series into scaled
 * SVG coordinates and path segments, splitting the line at year gaps so a
 * missing year renders as a visibly dashed "no data" segment rather than a
 * smooth (lying) interpolation (§3.2, TUIT-34 AC #4).
 */

export interface ChartPoint {
  readonly year: number;
  readonly value: number;
}

export interface ScaledPoint extends ChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PlotArea {
  readonly width: number;
  readonly height: number;
  readonly insets: Insets;
}

/** Default plot insets — shared by the static and interactive charts so their
 * coordinate systems align exactly (the overlay maps pointer → data). */
export const DEFAULT_INSETS: Insets = { top: 12, right: 16, bottom: 28, left: 64 };

/** A [min, max] domain; `padDomain` widens a value domain for headroom. */
export type Domain = readonly [number, number];

/**
 * Expand a value domain by a ratio on each end and clamp the floor at 0 (a
 * tuition axis that dips below zero would be meaningless). A degenerate domain
 * (single distinct value) is widened symmetrically so the line sits mid-plot.
 */
export function padDomain([min, max]: Domain, ratio = 0.08): Domain {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * ratio;
  return [Math.max(0, min - pad), max + pad];
}

/** The [min, max] of the years present, or null for an empty series. */
export function yearDomain(points: readonly ChartPoint[]): Domain | null {
  if (points.length === 0) {
    return null;
  }
  const years = points.map((point) => point.year);
  return [Math.min(...years), Math.max(...years)];
}

/** The [min, max] of the values present, or null for an empty series. */
export function valueDomain(points: readonly ChartPoint[]): Domain | null {
  if (points.length === 0) {
    return null;
  }
  const values = points.map((point) => point.value);
  return [Math.min(...values), Math.max(...values)];
}

/** A linear scale from a domain onto a pixel range. Flat domains map to `lo`. */
export function linearScale(
  domain: Domain,
  rangeLo: number,
  rangeHi: number,
): (value: number) => number {
  const [d0, d1] = domain;
  const span = d1 - d0;
  if (span === 0) {
    return () => rangeLo;
  }
  return (value: number) => rangeLo + ((value - d0) / span) * (rangeHi - rangeLo);
}

/**
 * Scale a series into pixel coordinates within the plot area. Y is inverted
 * (larger values sit higher, i.e. at smaller pixel-y). The x-domain is passed
 * in — not derived — so multiple series on one chart share an identical axis.
 */
export function scalePoints(
  points: readonly ChartPoint[],
  xDomain: Domain,
  yDomain: Domain,
  plot: PlotArea,
): ScaledPoint[] {
  const { width, height, insets } = plot;
  const xScale = linearScale(xDomain, insets.left, width - insets.right);
  const yScale = linearScale(yDomain, height - insets.bottom, insets.top);
  return points.map((point) => ({
    ...point,
    x: xScale(point.year),
    y: yScale(point.value),
  }));
}

export interface PathSegment {
  readonly d: string;
  /** `solid` between consecutive years; `gap` bridges a ≥2-year jump (dashed). */
  readonly kind: "solid" | "gap";
}

/**
 * Build per-edge path segments from scaled points, tagging each edge that spans
 * a missing year as a `gap`. Callers render `gap` segments dashed and dimmed
 * with a "no data" annotation. Fewer than two points yields no segments.
 */
export function buildLineSegments(points: readonly ScaledPoint[]): PathSegment[] {
  const segments: PathSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev === undefined || curr === undefined) {
      continue;
    }
    segments.push({
      d: `M ${fmt(prev.x)} ${fmt(prev.y)} L ${fmt(curr.x)} ${fmt(curr.y)}`,
      kind: curr.year - prev.year > 1 ? "gap" : "solid",
    });
  }
  return segments;
}

/** Round a coordinate to 2dp to keep SVG path strings compact and stable. */
function fmt(coordinate: number): string {
  return (Math.round(coordinate * 100) / 100).toString();
}

/**
 * Evenly spaced value-axis ticks across a domain, inclusive of both ends.
 * `count` is the number of intervals (so `count + 1` ticks).
 */
export function axisTicks(domain: Domain, count = 4): number[] {
  const [d0, d1] = domain;
  if (count <= 0 || d0 === d1) {
    return [d0];
  }
  const step = (d1 - d0) / count;
  return Array.from({ length: count + 1 }, (_, i) => d0 + step * i);
}
