import type { ReactNode } from "react";
import { InsufficientData, type MetricView } from "@tuitiontruth/ui";

export interface MetricNumberProps<T> {
  readonly metric: MetricView<T>;
  readonly render: (value: T) => ReactNode;
  readonly compact?: boolean;
}

/**
 * Renders a `MetricView` honestly: the formatted value on `ok`, or the explicit
 * insufficient-data marker (carrying its reason) otherwise. This is the single
 * choke point that guarantees a missing figure never silently becomes a `0`.
 */
export function MetricNumber<T>({ metric, render, compact = false }: MetricNumberProps<T>) {
  if (metric.status === "insufficient_data") {
    return <InsufficientData reason={metric.reason} compact={compact} />;
  }
  return <>{render(metric.value)}</>;
}
