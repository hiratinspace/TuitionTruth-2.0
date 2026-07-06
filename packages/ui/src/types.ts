/**
 * The serialized `Metric` shape as it arrives from /api/v1 — structurally
 * identical to analytics-core's `Metric<T>`, redeclared here so the UI layer
 * consumes API JSON without importing business-logic packages. Presentational
 * components render `insufficient_data` as an honest state, never a blank or 0.
 */
export type MetricView<T> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "insufficient_data"; readonly reason: string };

/** Provenance metadata for the signature chip (§3.1, TUIT-35). */
export interface Provenance {
  /** Human "as of" label, e.g. `Mar 2026`. */
  readonly asOf: string;
  /** Source label, e.g. `IPEDS`, `Scorecard`, `verified`. */
  readonly source: string;
  readonly sourceUrl?: string;
  /** ISO extraction timestamp, shown on reveal. */
  readonly extractedAt?: string;
  /** Extraction confidence 0–1, shown on reveal when present. */
  readonly confidence?: number;
}
