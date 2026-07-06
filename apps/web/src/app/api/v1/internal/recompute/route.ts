import { z } from "zod";
import type { SegmentCohort } from "@tuitiontruth/db";
import { isAuthorized } from "@/server/api/auth";
import { apiError, apiSuccess } from "@/server/api/http";
import {
  institutionTypeSchema,
  residencySchema,
  sectorSchema,
  stateSchema,
} from "@/server/api/params";
import { getCacheStore, institutionCachePrefix, segmentCacheKey } from "@/server/cache";
import { recomputeInstitution, recomputeSegment } from "@/server/analytics/precompute";

export const runtime = "nodejs";

const cohortSchema = z.object({
  residency: residencySchema,
  sector: sectorSchema.nullable().default(null),
  institutionType: institutionTypeSchema.nullable().default(null),
  state: stateSchema.nullable().default(null),
});

const bodySchema = z.object({
  institutionId: z.number().int().positive(),
  segments: z.array(cohortSchema).default([]),
});

/**
 * POST /api/v1/internal/recompute — the ETL-completion hook (§2.3, TUIT-28).
 * Rebuilds an institution's snapshots, invalidates its cached responses, then
 * refreshes any segment cohorts it belongs to. Authenticated: this is the sole
 * trigger that writes the read-model, so it fails closed without a valid key.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return apiError(401, "unauthorized", "A valid API key is required to trigger a recompute.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      400,
      "invalid_body",
      parsed.error.issues[0]?.message ?? "Invalid request body.",
    );
  }

  const { institutionId, segments } = parsed.data;
  await recomputeInstitution(institutionId);

  const cache = getCacheStore();
  await cache.deleteByPrefix(institutionCachePrefix(institutionId));

  let segmentsRecomputed = 0;
  for (const cohort of segments) {
    const target: SegmentCohort = {
      residencyStatus: cohort.residency,
      sector: cohort.sector,
      institutionType: cohort.institutionType,
      state: cohort.state,
    };
    const written = await recomputeSegment(target);
    await cache.delete(
      segmentCacheKey({
        residency: target.residencyStatus,
        sector: target.sector,
        institutionType: target.institutionType,
        state: target.state,
      }),
    );
    if (written) {
      segmentsRecomputed += 1;
    }
  }

  return apiSuccess(
    { institutionId, recomputed: true, segmentsRecomputed },
    { cached: false, computedAt: new Date().toISOString() },
  );
}
