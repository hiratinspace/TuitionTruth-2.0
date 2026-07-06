/**
 * The core honesty primitive of TuitionTruth.
 *
 * Tuition data is riddled with gaps: not every institution reports every field
 * every year. A single missing year must never be silently coerced to `0`, nor
 * silently interpolated — either would fabricate a trend and betray the whole
 * point of a trust product. Every analytics computation therefore returns a
 * `Metric<T>`: either a real value, or an explicit "insufficient data" state
 * carrying a human-readable reason the UI can surface.
 *
 * This type is the enforcement mechanism behind the cross-phase quality bar
 * "no silent interpolation, ever" (docs/BUILD_PLAN.md §2.3).
 */
export type Metric<T> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "insufficient_data"; readonly reason: string };

/** Construct a successful metric. */
export function ok<T>(value: T): Metric<T> {
  return { status: "ok", value };
}

/** Construct an explicit "insufficient data" metric with a surfaced reason. */
export function insufficient<T>(reason: string): Metric<T> {
  return { status: "insufficient_data", reason };
}

/** Type guard narrowing a metric to its successful branch. */
export function isOk<T>(metric: Metric<T>): metric is Extract<Metric<T>, { status: "ok" }> {
  return metric.status === "ok";
}

/**
 * Transform the value inside an `ok` metric, propagating `insufficient_data`
 * untouched. Lets callers chain calculations without repeatedly unwrapping.
 */
export function mapMetric<T, U>(metric: Metric<T>, fn: (value: T) => U): Metric<U> {
  if (metric.status === "ok") {
    return ok(fn(metric.value));
  }
  return metric;
}

/**
 * Extract the value or fall back to an explicit default. The default is a
 * deliberate, visible choice at the call site — never an implicit `?? 0`.
 */
export function unwrapOr<T>(metric: Metric<T>, fallback: T): T {
  return isOk(metric) ? metric.value : fallback;
}

/**
 * Combine two metrics, short-circuiting to the first `insufficient_data` state.
 * The reason is re-wrapped (rather than the branch reused) so the result's type
 * parameter is honest — a metric composed from two others carries no residual
 * variance from either input. Used to fuse dependent computations, e.g. a
 * net-price discount that needs both a sticker figure and a net figure.
 */
export function combineMetrics<A, B, C>(
  a: Metric<A>,
  b: Metric<B>,
  fn: (a: A, b: B) => Metric<C>,
): Metric<C> {
  if (a.status === "insufficient_data") {
    return insufficient(a.reason);
  }
  if (b.status === "insufficient_data") {
    return insufficient(b.reason);
  }
  return fn(a.value, b.value);
}
