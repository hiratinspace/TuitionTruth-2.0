/**
 * Uniform JSON envelope for /api/v1 (TUIT-27). Every response is either
 * `{ data, meta }` or `{ error: { code, message } }` — a stable contract the
 * typed client (Phase 4) generates against. `meta.cached` surfaces cache hits
 * so the load test can verify the p95-reduction target empirically.
 */
export interface ApiMeta {
  readonly cached: boolean;
  readonly computedAt: string | null;
}

export interface ApiErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

const NO_STORE = "no-store";

/**
 * A cacheable success response. When `sMaxAgeSeconds` is set, a shared-cache
 * (CDN) directive with stale-while-revalidate is attached — the public
 * institution pages are the freemium SEO surface, so edge caching matters.
 */
export function apiSuccess(data: unknown, meta: ApiMeta, sMaxAgeSeconds?: number): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  headers["cache-control"] =
    sMaxAgeSeconds === undefined
      ? NO_STORE
      : `public, s-maxage=${String(sMaxAgeSeconds)}, stale-while-revalidate=${String(sMaxAgeSeconds * 2)}`;
  return new Response(JSON.stringify({ data, meta }), { status: 200, headers });
}

/** A structured error response; never cached. */
export function apiError(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": NO_STORE },
  });
}
