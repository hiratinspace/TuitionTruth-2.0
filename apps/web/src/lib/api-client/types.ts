import type { MetricView } from "@tuitiontruth/ui";

/**
 * Wire DTOs for /api/v1 (TUIT-30). These mirror the server's response shapes
 * but are declared independently on purpose: the client speaks to the API over
 * HTTP, so this file *is* the contract boundary. Every analytics figure is a
 * `MetricView` — the UI must handle the `insufficient_data` branch explicitly.
 */

export interface CagrView {
  readonly rate: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly startValue: number;
  readonly endValue: number;
  readonly years: number;
}

export interface YoyView {
  readonly rate: number;
  readonly delta: number;
  readonly fromYear: number;
  readonly toYear: number;
  readonly fromValue: number;
  readonly toValue: number;
}

export interface NetPriceView {
  readonly sticker: number;
  readonly net: number;
  readonly aid: number;
  readonly discountRate: number;
}

export interface ProjectionView {
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

export interface SeriesPointDTO {
  readonly year: number;
  readonly value: number;
}

export interface AnalyticsMetrics {
  readonly latestSticker: MetricView<number>;
  readonly latestNet: MetricView<number>;
  readonly discount: MetricView<NetPriceView>;
  readonly cagr5yr: MetricView<CagrView>;
  readonly cagr10yr: MetricView<CagrView>;
  readonly yoy: MetricView<YoyView>;
  readonly projection: MetricView<ProjectionView>;
  readonly stickerSeries: readonly SeriesPointDTO[];
  readonly netSeries: readonly SeriesPointDTO[];
}

export interface InstitutionAnalyticsScalars {
  readonly latestSticker: number | null;
  readonly latestNet: number | null;
  readonly discountRate: number | null;
  readonly cagr5yr: number | null;
  readonly cagr10yr: number | null;
  readonly yoyRate: number | null;
  readonly projectionYear: number | null;
  readonly projectionValue: number | null;
}

export interface InstitutionAnalyticsDTO {
  readonly institutionId: number;
  readonly residency: string;
  readonly latestYear: number | null;
  readonly scalars: InstitutionAnalyticsScalars;
  readonly metrics: AnalyticsMetrics;
  readonly computedAt: string;
}

export interface InstitutionSummaryDTO {
  readonly id: number;
  readonly ipedsUnitId: number;
  readonly name: string;
  readonly city: string | null;
  readonly state: string;
  readonly sector: string;
  readonly institutionType: string;
  readonly websiteUrl: string | null;
}

export interface InstitutionSearchDTO {
  readonly results: readonly InstitutionSummaryDTO[];
  readonly count: number;
}

export interface SegmentAnalyticsDTO {
  readonly cohort: {
    readonly sector: string | null;
    readonly institutionType: string | null;
    readonly state: string | null;
    readonly residency: string;
  };
  readonly institutionCount: number;
  readonly sticker: {
    readonly mean: number;
    readonly median: number;
    readonly min: number;
    readonly max: number;
  };
  readonly computedAt: string;
}

export interface ApiMeta {
  readonly cached: boolean;
  readonly computedAt: string | null;
}

export interface ApiEnvelope<T> {
  readonly data: T;
  readonly meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  readonly error: { readonly code: string; readonly message: string };
}

export type Residency = "in_state" | "out_of_state";
