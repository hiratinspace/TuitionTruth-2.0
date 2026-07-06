/**
 * The cache contract the analytics API depends on (TUIT-28). Deliberately a
 * narrow string KV with TTL and prefix invalidation so any backend satisfies
 * it: the in-memory default below for local/dev/test, and an Upstash Redis
 * adapter in production (wired when REDIS_URL is set). The API never imports a
 * concrete backend — only this interface — so swapping stores is a config
 * change, not a code change.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Drop every entry whose key starts with `prefix` — the invalidation primitive. */
  deleteByPrefix(prefix: string): Promise<void>;
}

interface Entry {
  readonly value: string;
  readonly expiresAt: number;
}

/**
 * Process-local cache with TTL expiry and a bounded size (evicting the oldest
 * insertion when full). Fine for a single instance and for tests; production
 * uses the shared Redis store so invalidation reaches every instance. Time is
 * injected so tests can advance the clock deterministically without real waits.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 5_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return Promise.resolve(null);
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    // Refresh insertion order so recently-written keys survive eviction longest.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1_000 });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
    return Promise.resolve();
  }
}
