# ADR 0002 — Precomputed Analytics Read-Model (TUIT-21 → 28)

**Status:** Accepted (Phase 3)

## Context

Tuition data changes at most daily; user queries happen millions of times. Computing CAGR, YoY, net-price gaps, and projections on the request path would put unbounded math between the user and their answer, blowing the p95 < 300ms target (TUIT-27) and the > 70% cache-reduction target for segment aggregates (TUIT-28).

## Decision

**Compute at ingest time, read one indexed row at request time.**

1. **Pure math lives in `packages/analytics-core`** — CAGR (5/10-yr windows), YoY, net-vs-sticker, projection, and segment stats, each returning a `Metric<T>` discriminated union (`ok` value or `insufficient_data` + reason). No I/O; 100% branch coverage (62 tests). This is the single source of truth for every number the product shows.

2. **A precompute step materialises the results** into two read-model tables:
   - `analytics_snapshots` — one row per `(institution_id, residency_status)`, carrying flat scalar columns (for sorting/segment rollups) **and** a `jsonb payload` holding the full typed `Metric` union (including every `insufficient_data` reason). Scalars are nullable precisely because a metric may be insufficient — never a stand-in `0`.
   - `segment_snapshots` — one row per cohort `(sector?, institution_type?, state?, residency)`, with distribution stats (mean/median/min/max) over the cohort's latest sticker prices. A NULL dimension means "all"; median leads because tuition distributions are right-skewed.

3. **The API (`/api/v1`) only reads.** `GET /institutions/:id/analytics` and `GET /segments` each resolve to a single indexed row, wrapped in a Redis read-through cache keyed by `endpoint+params`. `POST /internal/recompute` (authenticated) is the sole write trigger — the ETL-completion hook — and invalidates the affected cache keys after rebuilding.

## Why this shape

- **Layer boundaries hold (§1.4).** `analytics-core` stays pure; `packages/db` owns only schema + repositories (the snapshot payload is typed by a local `MetricJson` contract, not an import of business logic); the composition root (`apps/web/src/server/analytics`) is the only place the two meet, reachable exclusively from server code (ESLint-enforced).
- **Idempotent by construction.** Snapshot writes upsert on the natural unique keys, so re-running the precompute after any ETL batch overwrites in place and never duplicates.
- **Honest gaps end-to-end.** Because every layer speaks `Metric`, a decade of missing history surfaces as a typed `insufficient_data` state in the JSON the UI renders — the "no silent interpolation, ever" baseline is a type, not a convention.

## Caching

- `CacheStore` is a narrow string-KV interface (`get`/`set`/`delete`/`deleteByPrefix`). The default `MemoryCacheStore` (TTL + bounded size) backs local/dev/test with zero infrastructure; production registers an Upstash Redis adapter implementing the same interface via `REDIS_URL`. Swapping backends is a config change, not a code change.
- TTL is `ANALYTICS_CACHE_TTL_SECONDS` (default 300s); recompute events invalidate proactively, so the TTL is only a safety net.

## Consequences

- The request path does no analytics computation — latency is a single indexed row read plus optional cache hit.
- A snapshot must exist before a page can render; a cold institution returns `404 snapshot_not_found` until the precompute runs, rather than computing on demand. This is intentional: it keeps the read path uniformly cheap and makes "is this institution live?" a data-state question, not a performance question.
- Segment aggregates read already-computed per-institution scalars, so a full-set rollup is a bounded indexed scan, not a re-derivation across thousands of institutions.
