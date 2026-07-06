import { env } from "@/env";

export const runtime = "nodejs";

/**
 * GET /api/v1/openapi.json — the machine-readable contract for /api/v1
 * (TUIT-27 "OpenAPI-documented, versioned"). Hand-authored to stay in lockstep
 * with the route handlers; the Phase 4 typed client is generated from this.
 */
export function GET(): Response {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "TuitionTruth Analytics API",
      version: "1.0.0",
      description:
        "Read access to precomputed tuition analytics. Every figure is a Metric: either a value or an explicit insufficient_data state with a reason — never a silent zero.",
    },
    servers: [{ url: `${env.NEXT_PUBLIC_APP_URL}/api/v1` }],
    paths: {
      "/institutions/{id}/analytics": {
        get: {
          summary: "Precomputed analytics for one institution",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
            {
              name: "residency",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["in_state", "out_of_state"], default: "in_state" },
            },
          ],
          responses: {
            "200": { $ref: "#/components/responses/InstitutionAnalytics" },
            "400": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/segments": {
        get: {
          summary: "Precomputed aggregate for a segment cohort",
          parameters: [
            {
              name: "residency",
              in: "query",
              schema: { type: "string", enum: ["in_state", "out_of_state"], default: "in_state" },
            },
            {
              name: "sector",
              in: "query",
              schema: { type: "string", enum: ["public", "private"] },
            },
            {
              name: "type",
              in: "query",
              schema: { type: "string", enum: ["two_year", "four_year"] },
            },
            { name: "state", in: "query", schema: { type: "string", pattern: "^[A-Za-z]{2}$" } },
          ],
          responses: {
            "200": { $ref: "#/components/responses/SegmentAnalytics" },
            "400": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/internal/recompute": {
        post: {
          summary: "Rebuild an institution's snapshots and invalidate caches",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["institutionId"],
                  properties: {
                    institutionId: { type: "integer", minimum: 1 },
                    segments: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Recompute completed" },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        Metric: {
          oneOf: [
            {
              type: "object",
              required: ["status", "value"],
              properties: { status: { const: "ok" }, value: {} },
            },
            {
              type: "object",
              required: ["status", "reason"],
              properties: { status: { const: "insufficient_data" }, reason: { type: "string" } },
            },
          ],
        },
        ApiError: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { type: "string" }, message: { type: "string" } },
            },
          },
        },
      },
      responses: {
        InstitutionAnalytics: {
          description: "One institution's precomputed analytics",
          content: { "application/json": { schema: { type: "object" } } },
        },
        SegmentAnalytics: {
          description: "One segment cohort's aggregate",
          content: { "application/json": { schema: { type: "object" } } },
        },
        Error: {
          description: "Structured error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
        },
      },
    },
  };

  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, s-maxage=3600" },
  });
}
