import { insufficient, mapMetric, ok, type Metric } from "./metric";
import { sortByYear, type DataPoint } from "./series";

/**
 * Compound Annual Growth Rate over a window, with the endpoints and span it was
 * actually derived from. `rate` is a decimal fraction (0.039 = 3.9%/yr). We
 * carry the endpoints so the UI can label a "5-year CAGR" honestly even when
 * the real span is 4 years because a year was missing (TUIT-24 AC #3).
 */
export interface CagrResult {
  readonly rate: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly startValue: number;
  readonly endValue: number;
  readonly years: number;
}

/**
 * Low-level CAGR: `(end / start) ^ (1 / years) - 1`. Negative growth is a valid
 * result (end < start). A non-positive base, non-positive end, or sub-annual
 * span cannot yield a meaningful rate and returns an explicit reason rather than
 * `NaN`/`Infinity` leaking into the UI.
 */
export function computeCagr(startValue: number, endValue: number, years: number): Metric<number> {
  if (years < 1) {
    return insufficient("CAGR needs a span of at least one year");
  }
  if (startValue <= 0) {
    return insufficient("CAGR base value must be positive");
  }
  if (endValue <= 0) {
    return insufficient("CAGR end value must be positive");
  }
  return ok((endValue / startValue) ** (1 / years) - 1);
}

/**
 * CAGR across the trailing `windowYears` of a series. Anchors on the latest
 * observation and the earliest observation that falls inside the window,
 * computing the rate over their real span. A series with no comparison point
 * inside the window (a single observation, or one isolated recent point)
 * returns insufficient — never a fabricated flat line.
 */
export function cagrForWindow(
  series: readonly DataPoint[],
  windowYears: number,
): Metric<CagrResult> {
  if (windowYears < 1) {
    return insufficient("CAGR window must be at least one year");
  }
  const sorted = sortByYear(series);
  const end = sorted.at(-1);
  if (end === undefined) {
    return insufficient("no observations available");
  }
  const windowStart = end.year - windowYears;
  const anchor = sorted.find((point) => point.year >= windowStart && point.year < end.year);
  if (anchor === undefined) {
    return insufficient(
      `no comparison year within ${String(windowYears)} years before ${String(end.year)}`,
    );
  }
  const years = end.year - anchor.year;
  return mapMetric(computeCagr(anchor.value, end.value, years), (rate) => ({
    rate,
    startYear: anchor.year,
    endYear: end.year,
    startValue: anchor.value,
    endValue: end.value,
    years,
  }));
}
