/**
 * Pure easing + interpolation helpers for the app's arrival motion (§3.3).
 * Isolated from React so the timing math is unit-tested directly.
 */

/** Clamp a value into [0, 1]. */
export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Ease-out cubic — fast start, gentle settle. Matches the "arrival" feel. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/**
 * The count-up display value at elapsed time `elapsedMs` of a `durationMs`
 * animation toward `target`, eased. Returns exactly `target` once complete so
 * the final frame is never a rounding artifact.
 */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return target;
  }
  return target * easeOutCubic(elapsedMs / durationMs);
}
