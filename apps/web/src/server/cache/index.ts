import { env } from "../../env";
import { MemoryCacheStore, type CacheStore } from "./store";

export { type CacheStore, MemoryCacheStore } from "./store";

/**
 * The cache key namespace. Versioned (`v1`) so a breaking change to the payload
 * shape can be rolled out by bumping the prefix rather than manually flushing.
 */
const NS = "ttv1";

/** Per-institution analytics key — the profile-page read path. */
export function institutionCacheKey(institutionId: number, residency: string): string {
  return `${NS}:inst:${String(institutionId)}:${residency}`;
}

/** Prefix covering every residency of one institution — the invalidation unit. */
export function institutionCachePrefix(institutionId: number): string {
  return `${NS}:inst:${String(institutionId)}:`;
}

/** Segment cohort key; `*` stands in for a wildcard (all) dimension. */
export function segmentCacheKey(parts: {
  readonly residency: string;
  readonly sector: string | null;
  readonly institutionType: string | null;
  readonly state: string | null;
}): string {
  const sector = parts.sector ?? "*";
  const type = parts.institutionType ?? "*";
  const state = parts.state ?? "*";
  return `${NS}:seg:${parts.residency}:${sector}:${type}:${state}`;
}

let store: CacheStore | null = null;

/**
 * The process-wide cache store. In-memory unless a distributed backend is
 * registered via `setCacheStore` (the Upstash adapter does this at startup when
 * REDIS_URL is present). A single instance is reused so the memory store's
 * contents persist across requests.
 */
export function getCacheStore(): CacheStore {
  store ??= new MemoryCacheStore();
  return store;
}

/** Register a backend (e.g. the Redis adapter) in place of the default. */
export function setCacheStore(next: CacheStore): void {
  store = next;
}

/**
 * Read-through cache around a loader. Returns the cached JSON when present,
 * otherwise loads, stores (unless the loader opts out via `shouldCache`), and
 * returns fresh. `cached` in the result tells the API whether to advertise a
 * cache hit — useful for the load-test verification of the p95-reduction goal.
 */
export async function readThrough<T>(
  key: string,
  loader: () => Promise<{ readonly value: T; readonly shouldCache: boolean }>,
  options: { readonly ttlSeconds?: number; readonly store?: CacheStore } = {},
): Promise<{ readonly value: T; readonly cached: boolean }> {
  const cache = options.store ?? getCacheStore();
  const ttl = options.ttlSeconds ?? env.ANALYTICS_CACHE_TTL_SECONDS;

  const hit = await cache.get(key);
  if (hit !== null) {
    return { value: JSON.parse(hit) as T, cached: true };
  }

  const { value, shouldCache } = await loader();
  if (shouldCache) {
    await cache.set(key, JSON.stringify(value), ttl);
  }
  return { value, cached: false };
}
