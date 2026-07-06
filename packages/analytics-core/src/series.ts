import { insufficient, ok, type Metric } from "./metric";

/**
 * A single observation in a tuition/net-price time series. `year` is the
 * academic start year (2024 → the 2024–25 year, matching the DB schema);
 * `value` is an exact dollar amount already parsed from the `numeric` column.
 * Series are the sole input shape to every analytics computation, which keeps
 * the math decoupled from the database representation.
 */
export interface DataPoint {
  readonly year: number;
  readonly value: number;
}

/**
 * Return a new array sorted oldest year first. Never mutates the input — the
 * caller's array (often a cached read-model row) stays untouched.
 */
export function sortByYear(series: readonly DataPoint[]): readonly DataPoint[] {
  return [...series].sort((a, b) => a.year - b.year);
}

/** The observation for an exact year, or `undefined` when that year has a gap. */
export function findByYear(series: readonly DataPoint[], year: number): DataPoint | undefined {
  return series.find((point) => point.year === year);
}

/**
 * The value of the most recent observation, or an explicit insufficient-data
 * state for an empty series — never a silent `0`.
 */
export function latestValue(series: readonly DataPoint[]): Metric<number> {
  const point = sortByYear(series).at(-1);
  if (point === undefined) {
    return insufficient("no observations available");
  }
  return ok(point.value);
}
