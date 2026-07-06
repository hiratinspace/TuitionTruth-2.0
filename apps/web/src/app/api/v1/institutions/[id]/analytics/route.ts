import { createAnalyticsSnapshotRepository, db } from "@tuitiontruth/db";
import { env } from "@/env";
import { institutionCacheKey, readThrough } from "@/server/cache";
import { apiError, apiSuccess } from "@/server/api/http";
import { toInstitutionResponse, type InstitutionAnalyticsResponse } from "@/server/api/mappers";
import { institutionIdSchema, residencySchema } from "@/server/api/params";

export const runtime = "nodejs";

/**
 * GET /api/v1/institutions/:id/analytics?residency=in_state|out_of_state
 *
 * Reads exactly one precomputed snapshot row through the cache. The request
 * path does no analytics math — that happened at ingest time (§2.3) — so p95
 * stays well under the 300ms target (TUIT-27). Public + edge-cacheable: these
 * institution pages are the freemium SEO surface.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsedId = institutionIdSchema.safeParse(id);
  if (!parsedId.success) {
    return apiError(400, "invalid_institution_id", "Institution id must be a positive integer.");
  }

  const residencyParam = new URL(request.url).searchParams.get("residency") ?? "in_state";
  const parsedResidency = residencySchema.safeParse(residencyParam);
  if (!parsedResidency.success) {
    return apiError(400, "invalid_residency", "residency must be in_state or out_of_state.");
  }

  const institutionId = parsedId.data;
  const residency = parsedResidency.data;
  const key = institutionCacheKey(institutionId, residency);

  const { value, cached } = await readThrough<InstitutionAnalyticsResponse | null>(
    key,
    async () => {
      const repo = createAnalyticsSnapshotRepository(db);
      const snapshot = await repo.get(institutionId, residency);
      if (snapshot === null) {
        // Don't cache a miss — the snapshot job may populate it momentarily.
        return { value: null, shouldCache: false };
      }
      return { value: toInstitutionResponse(snapshot), shouldCache: true };
    },
  );

  if (value === null) {
    return apiError(404, "snapshot_not_found", "No analytics snapshot for this institution yet.");
  }

  return apiSuccess(
    value,
    { cached, computedAt: value.computedAt },
    env.ANALYTICS_CACHE_TTL_SECONDS,
  );
}
