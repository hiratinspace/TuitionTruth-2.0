/**
 * Money rounding. Projections and derived figures are rounded to a coarse
 * increment on purpose — a forecast presented to the dollar implies a precision
 * the model does not have. The BUILD_PLAN mandates nearest-$100 on projections
 * (TUIT-25 AC) so the UI can never render false precision.
 */

/** The increment projections round to, so estimates never imply false precision. */
export const PROJECTION_INCREMENT = 100;

/**
 * Round `value` to the nearest `increment`. `increment` must be positive; a
 * non-positive increment is a programming error, not a data condition, so it
 * throws rather than returning a metric.
 */
export function roundToNearest(value: number, increment: number): number {
  if (increment <= 0) {
    throw new RangeError(
      `roundToNearest: increment must be positive, received ${String(increment)}`,
    );
  }
  return Math.round(value / increment) * increment;
}
