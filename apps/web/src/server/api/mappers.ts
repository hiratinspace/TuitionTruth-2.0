import type {
  AnalyticsSnapshot,
  AnalyticsSnapshotPayload,
  Institution,
  SegmentSnapshot,
} from "@tuitiontruth/db";

/** The public shape of an institution's identity (TUIT-31/32). */
export interface InstitutionSummaryResponse {
  readonly id: number;
  readonly ipedsUnitId: number;
  readonly name: string;
  readonly city: string | null;
  readonly state: string;
  readonly sector: string;
  readonly institutionType: string;
  readonly websiteUrl: string | null;
}

export function toInstitutionSummary(inst: Institution): InstitutionSummaryResponse {
  return {
    id: inst.id,
    ipedsUnitId: inst.ipedsUnitId,
    name: inst.name,
    city: inst.city,
    state: inst.state,
    sector: inst.sector,
    institutionType: inst.institutionType,
    websiteUrl: inst.websiteUrl,
  };
}

/** Parse a nullable `numeric` column string into a number, preserving null. */
function num(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** The public shape of a single institution's analytics (TUIT-27). */
export interface InstitutionAnalyticsResponse {
  readonly institutionId: number;
  readonly residency: string;
  readonly latestYear: number | null;
  /** Flat headline figures; `null` means insufficient data, never a stand-in 0. */
  readonly scalars: {
    readonly latestSticker: number | null;
    readonly latestNet: number | null;
    readonly discountRate: number | null;
    readonly cagr5yr: number | null;
    readonly cagr10yr: number | null;
    readonly yoyRate: number | null;
    readonly projectionYear: number | null;
    readonly projectionValue: number | null;
  };
  /** The full typed Metric union per figure — carries the insufficient reasons. */
  readonly metrics: AnalyticsSnapshotPayload;
  readonly computedAt: string;
}

export function toInstitutionResponse(snap: AnalyticsSnapshot): InstitutionAnalyticsResponse {
  return {
    institutionId: snap.institutionId,
    residency: snap.residencyStatus,
    latestYear: snap.latestYear,
    scalars: {
      latestSticker: num(snap.latestSticker),
      latestNet: num(snap.latestNet),
      discountRate: num(snap.discountRate),
      cagr5yr: num(snap.cagr5yr),
      cagr10yr: num(snap.cagr10yr),
      yoyRate: num(snap.yoyRate),
      projectionYear: snap.projectionYear,
      projectionValue: num(snap.projectionValue),
    },
    metrics: snap.payload,
    computedAt: snap.computedAt.toISOString(),
  };
}

/** The public shape of a segment aggregate (TUIT-27/28). */
export interface SegmentAnalyticsResponse {
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

export function toSegmentResponse(snap: SegmentSnapshot): SegmentAnalyticsResponse {
  return {
    cohort: {
      sector: snap.sector,
      institutionType: snap.institutionType,
      state: snap.state,
      residency: snap.residencyStatus,
    },
    institutionCount: snap.institutionCount,
    sticker: {
      mean: Number(snap.meanSticker),
      median: Number(snap.medianSticker),
      min: Number(snap.minSticker),
      max: Number(snap.maxSticker),
    },
    computedAt: snap.computedAt.toISOString(),
  };
}
