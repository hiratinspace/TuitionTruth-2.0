import { insufficient, ok, type Metric } from "./metric";
import { cagrForWindow } from "./cagr";
import { PROJECTION_INCREMENT, roundToNearest } from "./money";
import { type DataPoint } from "./series";

/**
 * A forward tuition estimate. Deliberately labelled and coarsely rounded: it is
 * an extrapolation, not a promise. `methodology` is a human-readable sentence
 * the UI renders next to the number so no projection is ever presented as fact
 * (TUIT-25 AC — "no false precision").
 */
export interface ProjectionResult {
  readonly projectedValue: number;
  readonly targetYear: number;
  readonly basisRate: number;
  readonly basisYears: number;
  readonly fromYear: number;
  readonly fromValue: number;
  readonly method: "cagr_extrapolation";
  readonly roundedToNearest: number;
  readonly methodology: string;
}

/**
 * Project the latest observed value forward to `targetYear` by compounding the
 * trailing `windowYears` CAGR. Insufficient history propagates from the CAGR
 * computation; a target at or before the latest observed year is rejected (you
 * cannot "project" the past). The result is rounded to the nearest $100.
 */
export function project(
  series: readonly DataPoint[],
  targetYear: number,
  windowYears: number,
): Metric<ProjectionResult> {
  const cagr = cagrForWindow(series, windowYears);
  if (cagr.status === "insufficient_data") {
    return insufficient(cagr.reason);
  }
  const { rate, endYear, endValue, years } = cagr.value;
  if (targetYear <= endYear) {
    return insufficient(
      `projection target ${String(targetYear)} must be after the latest observed year ${String(endYear)}`,
    );
  }
  const horizon = targetYear - endYear;
  const projectedValue = roundToNearest(endValue * (1 + rate) ** horizon, PROJECTION_INCREMENT);
  const ratePct = (rate * 100).toFixed(1);
  return ok({
    projectedValue,
    targetYear,
    basisRate: rate,
    basisYears: years,
    fromYear: endYear,
    fromValue: endValue,
    method: "cagr_extrapolation" as const,
    roundedToNearest: PROJECTION_INCREMENT,
    methodology: `Estimated by compounding the ${String(years)}-year CAGR (${ratePct}%/yr) forward from ${String(endYear)}, rounded to the nearest $${String(PROJECTION_INCREMENT)}.`,
  });
}
