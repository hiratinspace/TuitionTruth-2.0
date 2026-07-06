import { createInstitutionRepository, db } from "@tuitiontruth/db";
import { apiError, apiSuccess } from "@/server/api/http";
import { toInstitutionSummary } from "@/server/api/mappers";
import { institutionIdSchema } from "@/server/api/params";

export const runtime = "nodejs";

/**
 * GET /api/v1/institutions/:id — institution identity for the profile header
 * and search results (TUIT-32). Public and edge-cacheable; institution
 * metadata changes rarely, so a generous s-maxage is safe.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsedId = institutionIdSchema.safeParse(id);
  if (!parsedId.success) {
    return apiError(400, "invalid_institution_id", "Institution id must be a positive integer.");
  }

  const repo = createInstitutionRepository(db);
  const institution = await repo.getById(parsedId.data);
  if (institution === null) {
    return apiError(404, "institution_not_found", "No institution with that id.");
  }

  return apiSuccess(
    toInstitutionSummary(institution),
    { cached: false, computedAt: institution.updatedAt.toISOString() },
    3600,
  );
}
