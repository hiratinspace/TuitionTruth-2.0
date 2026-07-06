import type { DataPoint, InstitutionAnalytics, Metric } from "@tuitiontruth/analytics-core";
import type {
  AnalyticsSnapshotPayload,
  NewAnalyticsSnapshot,
  residencyStatusEnum,
} from "@tuitiontruth/db";

type ResidencyStatus = (typeof residencyStatusEnum.enumValues)[number];

/** The series the trend chart renders, threaded into the snapshot payload. */
export interface SnapshotSeries {
  readonly stickerSeries: readonly DataPoint[];
  readonly netSeries: readonly DataPoint[];
}

/** A money value for a `numeric(12,2)` column, or null for insufficient data. */
function moneyOrNull(metric: Metric<number>): string | null {
  return metric.status === "ok" ? metric.value.toFixed(2) : null;
}

/** A rate value for a `numeric(9,6)` column, extracted via a selector, or null. */
function rateOrNull<T>(metric: Metric<T>, select: (value: T) => number): string | null {
  return metric.status === "ok" ? select(metric.value).toFixed(6) : null;
}

/**
 * Project an `InstitutionAnalytics` (computed by analytics-core) onto a
 * persistable snapshot row. Pure and total: an `insufficient_data` metric maps
 * to a NULL scalar column — never a `0` — while the full typed union is
 * preserved in `payload` for the API to stream verbatim. The scalar columns
 * exist only so segment rollups and sorts avoid deserializing JSON.
 *
 * `latestYear` is threaded in from the source series (analytics-core works in
 * value-space and does not carry it), and is null exactly when there is no
 * observed sticker year at all.
 */
export function toSnapshotRow(
  institutionId: number,
  residencyStatus: ResidencyStatus,
  latestYear: number | null,
  analytics: InstitutionAnalytics,
  series: SnapshotSeries,
): NewAnalyticsSnapshot {
  const { projection } = analytics;
  // The payload's field types mirror analytics-core's Metric union exactly, so
  // this is a structural pass-through, not a re-encode.
  const payload: AnalyticsSnapshotPayload = {
    latestSticker: analytics.latestSticker,
    latestNet: analytics.latestNet,
    discount: analytics.discount,
    cagr5yr: analytics.cagr5yr,
    cagr10yr: analytics.cagr10yr,
    yoy: analytics.yoy,
    projection,
    stickerSeries: series.stickerSeries.map((point) => ({ year: point.year, value: point.value })),
    netSeries: series.netSeries.map((point) => ({ year: point.year, value: point.value })),
  };

  return {
    institutionId,
    residencyStatus,
    latestYear,
    latestSticker: moneyOrNull(analytics.latestSticker),
    latestNet: moneyOrNull(analytics.latestNet),
    discountRate: rateOrNull(analytics.discount, (d) => d.discountRate),
    cagr5yr: rateOrNull(analytics.cagr5yr, (c) => c.rate),
    cagr10yr: rateOrNull(analytics.cagr10yr, (c) => c.rate),
    yoyRate: rateOrNull(analytics.yoy, (y) => y.rate),
    projectionYear: projection.status === "ok" ? projection.value.targetYear : null,
    projectionValue: projection.status === "ok" ? projection.value.projectedValue.toFixed(2) : null,
    payload,
  };
}
