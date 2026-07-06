import { insufficient, ok, type Metric } from "./metric";
import { findByYear, sortByYear, type DataPoint } from "./series";

/**
 * Year-over-year change between two consecutive years. `rate` is a decimal
 * fraction; `delta` the absolute dollar move. Both prior- and current-year
 * context travel with the result so the UI can render "▲ +3.2% vs 2024".
 */
export interface YoyResult {
  readonly rate: number;
  readonly delta: number;
  readonly fromYear: number;
  readonly toYear: number;
  readonly fromValue: number;
  readonly toValue: number;
}

/**
 * YoY change ending at the latest observation. Requires the immediately prior
 * year to be present — a gap yields insufficient rather than silently comparing
 * across a multi-year jump, which would overstate a single year's increase
 * (TUIT-22 AC #2).
 */
export function yoyForLatest(series: readonly DataPoint[]): Metric<YoyResult> {
  const sorted = sortByYear(series);
  const current = sorted.at(-1);
  if (current === undefined) {
    return insufficient("no observations available");
  }
  const prior = findByYear(sorted, current.year - 1);
  if (prior === undefined) {
    return insufficient(
      `no ${String(current.year - 1)} observation; year-over-year needs consecutive years`,
    );
  }
  if (prior.value <= 0) {
    return insufficient("prior-year base value must be positive");
  }
  const delta = current.value - prior.value;
  return ok({
    rate: delta / prior.value,
    delta,
    fromYear: prior.year,
    toYear: current.year,
    fromValue: prior.value,
    toValue: current.value,
  });
}
