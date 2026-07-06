import { createAnalyticsSnapshotRepository, db, type SegmentCohort } from "@tuitiontruth/db";
import { env } from "@/env";
import { readThrough, segmentCacheKey } from "@/server/cache";
import { apiError, apiSuccess } from "@/server/api/http";
import { toSegmentResponse, type SegmentAnalyticsResponse } from "@/server/api/mappers";
import {
  institutionTypeSchema,
  optional,
  residencySchema,
  sectorSchema,
  stateSchema,
} from "@/server/api/params";

export const runtime = "nodejs";

/**
 * GET /api/v1/segments?residency=&sector=&type=&state=
 *
 * Returns one precomputed segment aggregate. Any dimension omitted widens the
 * cohort (no `sector` → all sectors; no `state` → national). Cached by cohort
 * key (TUIT-28) so repeated segment queries avoid even the single indexed read.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const parsedResidency = residencySchema.safeParse(params.get("residency") ?? "in_state");
  if (!parsedResidency.success) {
    return apiError(400, "invalid_residency", "residency must be in_state or out_of_state.");
  }

  const sector = optional(sectorSchema, params.get("sector"));
  if (!sector.ok) {
    return apiError(400, "invalid_sector", `sector: ${sector.issue}`);
  }
  const institutionType = optional(institutionTypeSchema, params.get("type"));
  if (!institutionType.ok) {
    return apiError(400, "invalid_type", `type: ${institutionType.issue}`);
  }
  const state = optional(stateSchema, params.get("state"));
  if (!state.ok) {
    return apiError(400, "invalid_state", `state: ${state.issue}`);
  }

  const cohort: SegmentCohort = {
    residencyStatus: parsedResidency.data,
    sector: sector.value,
    institutionType: institutionType.value,
    state: state.value,
  };
  const key = segmentCacheKey({
    residency: cohort.residencyStatus,
    sector: cohort.sector,
    institutionType: cohort.institutionType,
    state: cohort.state,
  });

  const { value, cached } = await readThrough<SegmentAnalyticsResponse | null>(key, async () => {
    const repo = createAnalyticsSnapshotRepository(db);
    const snapshot = await repo.getSegment(cohort);
    if (snapshot === null) {
      return { value: null, shouldCache: false };
    }
    return { value: toSegmentResponse(snapshot), shouldCache: true };
  });

  if (value === null) {
    return apiError(404, "segment_not_found", "No aggregate computed for this cohort yet.");
  }

  return apiSuccess(
    value,
    { cached, computedAt: value.computedAt },
    env.ANALYTICS_CACHE_TTL_SECONDS,
  );
}
