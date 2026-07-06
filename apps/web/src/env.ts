import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated web environment. Client variables must be prefixed NEXT_PUBLIC_ and
 * explicitly listed in `runtimeEnv` so Next.js can inline them. Defaults keep
 * local builds hermetic; production overrides them via real environment values.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /**
     * Optional Redis (Upstash) URL for the analytics cache (TUIT-28). Absent →
     * the API transparently falls back to an in-process LRU cache, so local dev
     * and tests need no Redis. Presence flips on the distributed cache.
     */
    REDIS_URL: z.string().url().optional(),
    /** Seconds a cached analytics response lives before recompute-time invalidation. */
    ANALYTICS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    /**
     * Comma-separated API keys accepted on the internal recompute endpoint and
     * any authenticated B2B routes. Empty → those routes are refused in
     * production and open only in development (see server/api/auth).
     */
    ANALYTICS_API_KEYS: z.string().default(""),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    ANALYTICS_CACHE_TTL_SECONDS: process.env.ANALYTICS_CACHE_TTL_SECONDS,
    ANALYTICS_API_KEYS: process.env.ANALYTICS_API_KEYS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
