import { env } from "@/env";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  InstitutionAnalyticsDTO,
  InstitutionSearchDTO,
  InstitutionSummaryDTO,
  Residency,
  SegmentAnalyticsDTO,
} from "./types";

/** A typed API failure, carrying the HTTP status and the server error code. */
export class TuitionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TuitionApiError";
  }

  /** True when the resource simply hasn't been computed/seeded yet (404). */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T; readonly cached: boolean }
  | { readonly ok: false; readonly error: TuitionApiError };

const RETRY_DELAYS_MS = [120, 360] as const;
const inFlight = new Map<string, Promise<unknown>>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErrorEnvelope(body: unknown): body is ApiErrorEnvelope {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorEnvelope).error.code === "string"
  );
}

/**
 * Core GET: absolute URL (works in both RSC and browser), retry on network
 * failure or 5xx (never on a 4xx — those are deterministic), and in-flight
 * dedup so concurrent identical requests share one round-trip. A 4xx resolves
 * to a typed error result rather than throwing, so callers branch exhaustively.
 */
async function getJson<T>(path: string): Promise<ApiResult<T>> {
  const url = `${env.NEXT_PUBLIC_APP_URL}${path}`;

  const existing = inFlight.get(url);
  if (existing !== undefined) {
    return existing as Promise<ApiResult<T>>;
  }

  const run = (async (): Promise<ApiResult<T>> => {
    let lastError: TuitionApiError | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
          next: { revalidate: env.ANALYTICS_CACHE_TTL_SECONDS },
        });
        const body: unknown = await res.json();

        if (res.ok) {
          const envelope = body as ApiEnvelope<T>;
          return { ok: true, data: envelope.data, cached: envelope.meta.cached };
        }

        const code = isErrorEnvelope(body) ? body.error.code : "unknown_error";
        const message = isErrorEnvelope(body) ? body.error.message : res.statusText;
        const error = new TuitionApiError(res.status, code, message);
        // 4xx is deterministic — do not retry.
        if (res.status < 500) {
          return { ok: false, error };
        }
        lastError = error;
      } catch {
        lastError = new TuitionApiError(0, "network_error", `Request to ${path} failed.`);
      }

      const backoff = RETRY_DELAYS_MS[attempt];
      if (backoff !== undefined) {
        await delay(backoff);
      }
    }
    return {
      ok: false,
      error: lastError ?? new TuitionApiError(0, "network_error", "Request failed."),
    };
  })();

  inFlight.set(url, run);
  try {
    return await run;
  } finally {
    inFlight.delete(url);
  }
}

/** Fetch one institution's precomputed analytics. */
export function getInstitutionAnalytics(
  institutionId: number,
  residency: Residency,
): Promise<ApiResult<InstitutionAnalyticsDTO>> {
  return getJson<InstitutionAnalyticsDTO>(
    `/api/v1/institutions/${String(institutionId)}/analytics?residency=${residency}`,
  );
}

/** Fetch one institution's identity for the profile header. */
export function getInstitution(institutionId: number): Promise<ApiResult<InstitutionSummaryDTO>> {
  return getJson<InstitutionSummaryDTO>(`/api/v1/institutions/${String(institutionId)}`);
}

export interface InstitutionSearchQuery {
  readonly q?: string;
  readonly sector?: "public" | "private";
  readonly institutionType?: "two_year" | "four_year";
  readonly state?: string;
}

/** Search the institution directory (TUIT-31). */
export function searchInstitutions(
  query: InstitutionSearchQuery,
): Promise<ApiResult<InstitutionSearchDTO>> {
  const params = new URLSearchParams();
  if (query.q !== undefined && query.q.trim().length > 0) {
    params.set("q", query.q.trim());
  }
  if (query.sector !== undefined) {
    params.set("sector", query.sector);
  }
  if (query.institutionType !== undefined) {
    params.set("type", query.institutionType);
  }
  if (query.state !== undefined) {
    params.set("state", query.state);
  }
  return getJson<InstitutionSearchDTO>(`/api/v1/institutions?${params.toString()}`);
}

export interface SegmentQuery {
  readonly residency: Residency;
  readonly sector?: "public" | "private";
  readonly institutionType?: "two_year" | "four_year";
  readonly state?: string;
}

/** Fetch one segment cohort aggregate. */
export function getSegmentAnalytics(query: SegmentQuery): Promise<ApiResult<SegmentAnalyticsDTO>> {
  const params = new URLSearchParams({ residency: query.residency });
  if (query.sector !== undefined) {
    params.set("sector", query.sector);
  }
  if (query.institutionType !== undefined) {
    params.set("type", query.institutionType);
  }
  if (query.state !== undefined) {
    params.set("state", query.state);
  }
  return getJson<SegmentAnalyticsDTO>(`/api/v1/segments?${params.toString()}`);
}
