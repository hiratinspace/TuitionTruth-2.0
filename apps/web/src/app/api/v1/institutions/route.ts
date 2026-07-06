import { createInstitutionRepository, db } from "@tuitiontruth/db";
import { apiError, apiSuccess } from "@/server/api/http";
import { toInstitutionSummary } from "@/server/api/mappers";
import { institutionTypeSchema, optional, sectorSchema, stateSchema } from "@/server/api/params";

export const runtime = "nodejs";

/**
 * GET /api/v1/institutions?q=&sector=&type=&state=&limit= — directory search
 * (TUIT-31). Case-insensitive name match plus segment filters, bounded result
 * set. Cached briefly: the directory is public and largely static between
 * ingestion runs.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

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

  const q = params.get("q");
  const repo = createInstitutionRepository(db);
  const results = await repo.search({
    ...(q !== null && q.trim().length > 0 ? { query: q } : {}),
    ...(sector.value !== null ? { sector: sector.value } : {}),
    ...(institutionType.value !== null ? { institutionType: institutionType.value } : {}),
    ...(state.value !== null ? { state: state.value } : {}),
    limit: 25,
  });

  return apiSuccess(
    { results: results.map(toInstitutionSummary), count: results.length },
    { cached: false, computedAt: null },
    60,
  );
}
