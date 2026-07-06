/**
 * Presentation formatters. Centralised so every dollar and percent in the app
 * reads identically — tabular figures, consistent rounding, signed deltas. No
 * formatter ever invents precision the data doesn't have (projections arrive
 * pre-rounded from analytics-core).
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const USD_CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar currency, e.g. `$62,484` — the default for headline figures. */
export function formatCurrency(value: number): string {
  return USD.format(value);
}

/** Cent-precise currency for line-item cost tables. */
export function formatCurrencyCents(value: number): string {
  return USD_CENTS.format(value);
}

/**
 * A growth/change rate (decimal fraction) as a signed percent, e.g. `+3.9%`,
 * `−1.2%`, `0.0%`. Uses a true minus glyph, and always shows the sign so
 * direction is legible before the eye reaches the arrow icon.
 */
export function formatPercent(rate: number, fractionDigits = 1): string {
  const pct = rate * 100;
  const rounded = Number(pct.toFixed(fractionDigits));
  const magnitude = Math.abs(rounded).toFixed(fractionDigits);
  if (rounded > 0) {
    return `+${magnitude}%`;
  }
  if (rounded < 0) {
    return `−${magnitude}%`;
  }
  return `${(0).toFixed(fractionDigits)}%`;
}

/** The academic-year label for a start year, e.g. 2024 → `2024–25`. */
export function formatAcademicYear(startYear: number): string {
  const end = (startYear + 1) % 100;
  return `${String(startYear)}–${end.toString().padStart(2, "0")}`;
}

/** An inclusive span of start years, e.g. `2011 – 2026`. */
export function formatYearRange(fromYear: number, toYear: number): string {
  return `${String(fromYear)} – ${String(toYear)}`;
}

export type Direction = "rising" | "falling" | "flat";

/**
 * Classify a rate into a direction. `flat` covers exact zero and negligible
 * moves within `epsilon`, so a rounding-dust change never renders a misleading
 * arrow. Directional color is only ever paired with the matching arrow + text.
 */
export function directionOf(rate: number, epsilon = 0.0005): Direction {
  if (rate > epsilon) {
    return "rising";
  }
  if (rate < -epsilon) {
    return "falling";
  }
  return "flat";
}
