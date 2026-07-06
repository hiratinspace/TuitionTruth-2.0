import { insufficient, ok, type Metric } from "./metric";

/**
 * Distribution statistics for a segment (e.g. "public 4-year in CA"). Median
 * travels alongside mean because tuition distributions are right-skewed — a few
 * high-sticker privates drag the mean, so the median is the more honest
 * "typical" figure the UI leads with (TUIT-8 / TUIT-27 segment aggregates).
 */
export interface SegmentStats {
  readonly count: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Median of an already-sorted, non-empty array. Uses a centred slice rather than
 * index arithmetic so it stays total under `noUncheckedIndexedAccess`: for even
 * length it averages the two central values, for odd length it takes the middle.
 */
function medianOfSorted(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  const isEven = sorted.length % 2 === 0;
  const centre = sorted.slice(isEven ? mid - 1 : mid, mid + 1);
  return centre.reduce((sum, value) => sum + value, 0) / centre.length;
}

/**
 * Aggregate a segment's values into distribution stats. An empty segment is an
 * explicit insufficient-data state — the UI shows "no institutions match" rather
 * than a misleading `$0` average. Values with insufficient upstream data must be
 * filtered out by the caller before aggregation, never passed as `0`.
 */
export function segmentStats(values: readonly number[]): Metric<SegmentStats> {
  if (values.length === 0) {
    return insufficient("segment contains no institutions with data");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return ok({
    count: sorted.length,
    mean: total / sorted.length,
    median: medianOfSorted(sorted),
    min: Math.min(...sorted),
    max: Math.max(...sorted),
  });
}
