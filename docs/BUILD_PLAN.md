# TuitionTruth 2.0 — Comprehensive Web Build Blueprint

**Product thesis:** _"What will this degree actually cost me, and how fast is that number rising?"_
**Format:** Desktop-first, fully responsive web app. Every number carries visible provenance.

**Source inputs:** `tuition-tracker-linear-backlog.md` (37 tickets, TUIT-1 → TUIT-37) and `tuition-tracker-scoping-analysis.md`.
**Critical path:** TUIT-1 → 3 → 4 → 9 → 13 → 16 → 21 → 27 → 28 → 32 → 33/34 → 36.

---

## 1. WORKSPACE ARCHITECTURE

### 1.1 Stack Decision Table

| Layer              | Choice                                                                      | Why                                                                                                 |
| ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Web app            | **Next.js 15 (App Router) + TypeScript**                                    | RSC for fast data-heavy pages, SEO for institution pages (freemium funnel per scoping doc)          |
| API                | **Next.js Route Handlers, `/api/v1/*`**                                     | One deployable for v1; extract to a standalone service only when B2B API demand is proven           |
| Ingestion          | **Python 3.12 service (separate app)**                                      | Scraping/ETL ecosystem (Playwright, pdfplumber, pandas for IPEDS flat files) is strongest in Python |
| Database           | **PostgreSQL 16 (Neon or Supabase)**                                        | Backlog's system of record; branching DBs give free staging (TUIT-1)                                |
| ORM / migrations   | **Drizzle ORM + drizzle-kit** — single migration owner                      | One tool owns schema; Python side reads via SQLAlchemy Core against the same tables (TUIT-2)        |
| Cache              | **Redis (Upstash)**                                                         | Serves both TUIT-12 (source caching) and TUIT-28 (analytics caching)                                |
| Orchestration      | **Dagster** (Python)                                                        | Asset-based lineage fits "source → canonical → analytics" better than cron; satisfies TUIT-19       |
| Charts             | **visx** (low-level) or **Recharts** (fast) — decide in Phase 4, spike both | TUIT-34 requires documented library choice with 15-yr dataset perf test                             |
| Component workshop | **Storybook 8**                                                             | TUIT-29 acceptance criterion                                                                        |

### 1.2 Monorepo Layout (Turborepo + pnpm)

```
tuitiontruth/
├── apps/
│   ├── web/                        # Next.js — all user-facing UI + API routes
│   │   ├── app/
│   │   │   ├── (marketing)/            # Landing, pricing, methodology
│   │   │   ├── (dashboard)/
│   │   │   │   ├── search/             # TUIT-31
│   │   │   │   ├── institution/[id]/   # TUIT-32 profile page
│   │   │   │   └── compare/            # Comparison dashboard (v1.5)
│   │   │   ├── admin/review-queue/     # TUIT-18 internal QA UI
│   │   │   └── api/v1/                 # TUIT-27 analytics endpoints
│   │   ├── components/                 # Page-scoped composites
│   │   └── lib/api-client/             # TUIT-30 typed fetch layer
│   └── pipeline/                   # Python ingestion service
│       ├── sources/                    # scorecard.py, ipeds.py — one module per source
│       ├── scrapers/
│       │   ├── framework/              # TUIT-13 generic engine
│       │   └── configs/                # TUIT-14 per-institution YAML (version-controlled)
│       ├── etl/                        # TUIT-16 canonical normalization
│       ├── quality/                    # TUIT-17 diffing, TUIT-26 anomaly detection
│       └── dags/                       # Dagster asset definitions (TUIT-19)
├── packages/
│   ├── db/                         # Drizzle schema + migrations — THE source of truth
│   ├── ui/                         # TUIT-29 design system (tokens, primitives, Storybook)
│   ├── analytics-core/             # Pure TS: CAGR, YoY, projection math (TUIT-21/24/25)
│   │                               #   — zero I/O, 100% unit-testable, shared by API + tests
│   └── config/                     # Shared tsconfig, eslint-config
├── docs/
│   ├── decisions/                  # ADRs (chart lib, precedence rules, config storage)
│   └── data-dictionary.md          # Fee taxonomy (TUIT-5 AC), IPEDS field mappings (TUIT-11)
└── turbo.json
```

### 1.3 Configuration Baselines

- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Financial data code gets no escape hatches.
- **ESLint:** flat config; `@typescript-eslint/strict-type-checked` + `no-restricted-imports` to enforce layer boundaries (UI may not import `db` directly — API client only).
- **Env management:** `@t3-oss/env-nextjs` — every env var declared in a Zod schema; build fails on missing secrets. Mirrors TUIT-1's "no credentials in code" criterion.
- **Python side:** `ruff` + `mypy --strict` + `pydantic` models for every scraper output — malformed extractions fail loudly (TUIT-13 AC #4).
- **CI gates on every PR:** typecheck → lint → unit tests → `drizzle-kit check` (no drift) → Storybook build.

### 1.4 Separation of Concerns (hard boundaries)

| Layer                     | Owns                                              | Never touches                         |
| ------------------------- | ------------------------------------------------- | ------------------------------------- |
| `apps/pipeline`           | Raw fetch, extraction, normalization, QA flagging | Serving user traffic                  |
| `packages/db`             | Schema, migrations, constraints                   | Business logic                        |
| `packages/analytics-core` | Pure math (CAGR/YoY/projection)                   | I/O, HTTP, SQL                        |
| `apps/web/api/v1`         | Auth, caching, response shaping                   | Extraction logic, raw SQL in handlers |
| `apps/web` (client)       | Presentation, interaction                         | Direct DB access                      |

**Rule:** data flows one direction — `pipeline → db → analytics API → UI`. The QA review queue (TUIT-18) is the _only_ human write-path into production data.

---

## 2. HIGH-PERFORMANCE BACKEND & PIPELINES

### 2.1 Data Infrastructure

- **Three-tier source strategy** (from the scoping analysis, in trust order):
  1. **College Scorecard API** — backbone; historical + net price. 1,000 req/hr limit → Redis cache with per-datatype TTL (TUIT-10/12).
  2. **IPEDS bulk flat files** — authoritative finance fields; idempotent pandas import keyed on `(unitid, year)`, provisional/final flags preserved (TUIT-11).
  3. **Scraped bursar pages** — the _only_ source of current-year pricing; this is the product's real differentiator.
- **API discovery directory:** [hiratinspace/public-apis](https://github.com/hiratinspace/public-apis) — curated free-API list; first stop when scouting a new data source before building anything custom.
  - Most relevant categories: **Government** (federal/state education & budget data), **Open Data** (Census, BLS-adjacent datasets for future CPI-aware projections), **Finance** (rate/inflation context for the forecasting engine).
  - Candidate uses: cross-validation sources alongside the Urban Institute portal, state-level tuition-cap datasets, CPI/regional-economics feeds for the Phase 3+ multi-factor projection models.
  - **Guardrail:** any API adopted from this list enters through the same pipeline as every other source — its own `sources/` module, `raw_*` staging table, documented precedence entry in the ADR, and `source_type`/`source_url` provenance on every row. No side doors.
- **Staging-table pattern:** every source lands in `raw_*` tables first; ETL promotes to canonical tables. Re-runs are idempotent by construction (TUIT-16 AC #4).
- **Precedence rule (documented in ADR):** scraped current-year > Scorecard > IPEDS for sticker price; IPEDS > Scorecard for finance fields; conflicts logged, never silently overwritten.

### 2.2 Scraping Pipeline — parallel, polite, compliance-first

- **Config-driven, not code-driven:** per-institution YAML configs (selectors, target URL, field maps) in version control — analysts add schools without code changes (TUIT-14).
- **Parallelization model:** `asyncio` worker pool, **partitioned by domain** — up to 50 institutions concurrently, but strictly ≤1 request per domain per 10s. Throughput comes from breadth across 6,000 domains, never from hammering one.
- **PDF handling (the unstandardized reality):** three-stage ladder —
  1. `pdfplumber` table extraction against config-declared page/region.
  2. On failure: **LLM structured extraction** (Claude Sonnet 5 with a strict JSON schema: `{academic_year, residency_status, tuition, mandatory_fees}` + confidence score).
  3. Confidence < 0.9 → route to human QA queue, never auto-commit.
- **Anti-bot posture — deliberately conservative** (this is a compliance decision, not a capability gap): respect `robots.txt` by default with manual-approval override (TUIT-13 AC #2); honest User-Agent identifying TuitionTruth with contact email; exponential backoff on 403/429 with the institution flagged for manual config review — **no CAPTCHA-solving or fingerprint evasion**. Public-data scraping is legally defensible only while crawling stays polite (per the scoping doc's _hiQ_ analysis). Blocked schools become partnership/manual-entry candidates instead.
- **Change detection as the safety net:** hash extracted numeric fields → diff against last audit-logged value → substantive changes create _pending review_ records, never live writes (TUIT-17). Human approves/rejects in the admin queue with full audit trail (TUIT-18).

### 2.3 Analytics Computation Model — precompute everything

- **Key insight:** tuition data changes at most daily; user queries happen millions of times. So **compute at ingest-time, not request-time.**
- **Materialized `analytics_snapshots` table:** after every successful ETL run + QA approval, a Dagster asset recomputes CAGR (5/10yr), YoY, net-price series, and projections per institution + per segment, writing to a flat, indexed read-model.
- **Request path:** API reads one indexed row → p95 well under the 300ms target (TUIT-27) with near-zero compute.
- **Redis layer on top** keyed by `endpoint+params`, invalidated by ETL completion events (TUIT-28) — targets the >70% p95 reduction criterion for segment aggregates.
- **Null discipline (non-negotiable):** missing years are _never_ silently interpolated; `analytics-core` returns typed `{value} | {status: "insufficient_data", reason}` unions so the UI can render honest states (TUIT-21/22/24 ACs).
- **Anomaly detection:** new values outside the trailing-CAGR-implied tolerance band get flagged with human-readable explanations ("42% above trend-implied value") into the same QA queue (TUIT-26).

---

## 3. WORLD-CLASS UI/UX DESIGN SYSTEM

### 3.1 Visual Identity — "The Modern Registrar's Ledger"

**Design thesis:** This is a trust product about money. The aesthetic vernacular comes from the subject's own world — audited financial statements, registrar documents, federal datasets — elevated to premium digital craft. Not fintech-neon, not startup-playful.

**Signature element (the one memorable thing):** the **Provenance Chip**. Every displayed number carries an attached micro-tag — `as of Mar 2026 · IPEDS` — rendered like a ledger citation. Hovering it reveals source URL, extraction timestamp, and confidence. No competitor treats provenance as a first-class visual object; it _is_ the brand (and it's already mandated by TUIT-35).

**Color palette** (WCAG AA verified):

| Token           | Hex       | Role                                                                    |
| --------------- | --------- | ----------------------------------------------------------------------- |
| `--ink`         | `#152A4A` | Foreground, headings — deep institutional ink                           |
| `--paper`       | `#FAFBF9` | Background — warm document white, not sterile gray                      |
| `--primary`     | `#1E40AF` | Interactive elements, links, active states                              |
| `--rising`      | `#B45309` | Tuition increases — amber, urgent but not alarmist                      |
| `--falling`     | `#0F766E` | Decreases/flat — teal (never green/red pairs; colorblind-safe per WCAG) |
| `--muted`       | `#E8ECE9` | Card borders, dividers, skeleton base                                   |
| `--destructive` | `#DC2626` | Errors, data-quality warnings only                                      |

- Directional color is **always paired with an arrow icon + text** — color never carries meaning alone.
- Dark mode: designed in parallel from day one using desaturated tonal variants, contrast-tested independently.

**Typography** (IBM Plex tri-family — institutional-document DNA, one cohesive voice):

| Role    | Face                          | Usage                                                                                 |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| Display | **IBM Plex Serif** 600        | Page titles, institution names, the "aha" numbers                                     |
| Body/UI | **IBM Plex Sans** 400/500     | Everything interactive and explanatory                                                |
| Data    | **IBM Plex Mono** 500, `tnum` | Every dollar figure, %, table column — tabular figures prevent layout shift on toggle |

- Type scale: `13 / 14 / 16 / 18 / 22 / 28 / 40 / 56` — the 56px slot exists for exactly one thing: the net-price headline number.
- Body minimum 16px; line-height 1.6; data-table line-height 1.4.

**Layout grid:**

- 12-column grid, `max-w-[1320px]`, 24px gutters; dashboard density spacing scale `8 / 12 / 16 / 24 / 32 / 48`.
- Breakpoints: 1440 (design target) / 1024 / 768 / 375. Desktop-first per product spec, with every component's stack-order defined at spec time — responsiveness isn't retrofitted (TUIT-36).

### 3.2 Tuition Comparison Dashboard — Layout Blueprint

**Institution profile page (v1 atomic unit)** — net price + trend above the fold (per scoping doc):

```
┌──────────────────────────────────────────────────────────────────┐
│ ◱ TuitionTruth      [Search institutions…]        [In-state ⇄]   │ ← sticky, 64px
├──────────────────────────────────────────────────────────────────┤
│ Stanford University          ⓘ as of Mar 2026 · IPEDS + verified │ ← Provenance Chip
│ Private 4-year · Stanford, CA                                    │
├────────────────────┬─────────────────────────────────────────────┤
│  NET PRICE (est.)  │   HISTORICAL TREND  2011 ─ 2026             │
│                    │                                             │
│    $18,279         │      ╭──── sticker ────────────╮ $62,484    │
│    Plex Serif 56px │   ───╯   ・・・gap year・・・              │
│                    │   ─────── net price ──────────── $18,279    │
│  after avg. aid    │   [Sticker ⊙] [Net ⊙]  hover → value+source │
├────────┬───────┬───┴────┬─────────┬────────────────────────────── │
│ STICKER│ 5Y CAGR│ 10Y   │ YoY     │ PROJECTED 2030               │ ← "Big 5" cards
│ $62,484│ +3.9%  │ +4.4% │ ▲ +3.2% │ ~$73,100 (estimate ⓘ)        │
├────────┴───────┴────────┴─────────┴───────────────────────────── │
│  Cost breakdown table (tuition / fees / room / board · Plex Mono)│
│  [Export CSV]                        disclaimer: informational…  │
└──────────────────────────────────────────────────────────────────┘
```

**Comparison dashboard (v1.5)** — up to 4 institutions:

- Left rail (280px): filter panel — state, sector, 2yr/4yr, residency toggle; all state in URL params (shareable links, TUIT-31 AC #5).
- Center: multi-line trend chart, one hue per school + distinct dash patterns (never hue alone); interactive legend toggles series.
- Below: sticky-first-column comparison table, rows = Big 5 metrics, columns = schools; per-cell winner highlighted with a subtle `--paper`-tinted band.
- Gaps in any school's history render as **visible dashed segments with a "no data" annotation** — honesty is the aesthetic (TUIT-34 AC #4).

### 3.3 Micro-interactions & Perceived Speed

- **Skeletons mirror real layout exactly** — chart skeleton shows axis bones + shimmering line path, cards show number-block placeholders. No spinners on primary surfaces; no layout shift on hydration (CLS < 0.1).
- **Residency toggle:** 180ms crossfade on affected numbers only; Plex Mono tabular figures mean zero reflow. Old value stays visible (dimmed 40%) until new data lands — never a blank flash.
- **Chart entrance:** line draws left-to-right, 400ms `ease-out`, once per session; instantly complete under `prefers-reduced-motion`.
- **Number roll-up:** headline metrics count up 300ms on first paint only — arrival, not decoration.
- **Hover:** cards lift `translateY(-1px)` + border deepens, 150ms; chart tooltip follows cursor with 60ms lag for weight.
- **Motion tokens:** two durations (150ms micro / 300ms transition), one easing (`cubic-bezier(0.2, 0, 0, 1)`), globally shared — the whole app has one rhythm.
- **Perceived-speed contract:** RSC streams shell instantly; cached analytics reads mean data typically beats the skeleton. Skeleton appears only past 200ms; interaction feedback within 100ms, always.

---

## 4. PHASED STEP-BY-STEP BUILD PLAN

> Sequencing honors the backlog's critical path. Data schema first. UI last — but the design system starts in parallel (TUIT-29 has zero backend deps).

### Phase 0 — Workspace Bootstrap _(3–4 days)_

- Scaffold Turborepo per §1.2; wire CI (typecheck, lint, test, migration-drift check).
- Provision Neon staging + prod branches, Upstash Redis, secrets manager (TUIT-1).
- Set up Drizzle migration tooling with verified up/down on staging (TUIT-2).

**Exit criteria:** ✅ `pnpm turbo build` green in CI · ✅ dummy migration applied + rolled back with no data loss · ✅ zero credentials in repo.

### Phase 1 — Bulletproof Data Schema _(TUIT-3 → 9, ~2 wks)_

- Ship tables in dependency order: `institutions` → `tuition_rates` / `fees_breakdown` / `net_price_data` → `audit_log` → indexes → CHECK constraints.
- Seed ~6,000 institutions from the IPEDS directory; unique constraint on `unitid`.
- Immutable audit log (DB-role-level: no UPDATE/DELETE grants).

**Exit criteria:** ✅ 10k-row seeded dataset with top-5 dashboard queries under 100ms (EXPLAIN ANALYZE documented) · ✅ 10+ malformed-input rejection tests passing · ✅ single-record history query <200ms · ✅ fee taxonomy documented in `data-dictionary.md`.
**Quality bar:** no schema PR merges without a reversible migration + updated data dictionary.

### Phase 1‖ — Design System, in parallel _(TUIT-29)_

- Implement §3.1 tokens as CSS variables + Tailwind theme in `packages/ui`.
- Build primitives: Button, Card, Badge, Input, DataTable, **ProvenanceChip**, Skeleton — each with Storybook stories + a11y checks (contrast, focus rings).

**Exit criteria:** ✅ Storybook deployed · ✅ every primitive passes axe-core · ✅ dark mode variants shipped simultaneously.

### Phase 2 — Ingestion Pipelines _(TUIT-10 → 20, ~4–5 wks; highest-risk phase)_

- **Week 1–2:** Scorecard client (rate-limited, cached) + IPEDS bulk connector (idempotent) — v1 can ship on these alone per the scoping doc's bottom line.
- **Week 2–3:** scraper framework + config system; 3 proof-of-concept configs end-to-end.
- **Week 3–4:** Top-100 scraper batch; ETL normalization with documented precedence rules.
- **Week 4–5:** diffing engine → QA review queue (admin UI, using Phase 1‖ primitives) → Dagster orchestration + Slack alerting with dedup.

**Exit criteria:** ✅ one sample institution flows raw-source → normalized tables end-to-end · ✅ 20-config random spot-check shows >95% extraction accuracy · ✅ simulated tuition change produces exactly one pending-review item · ✅ re-running any import creates zero duplicates · ✅ runbook covers top-3 failure modes.
**Quality bar:** no scraped value ever reaches production tables without passing the diff→QA gate.

### Phase 3 — Analytical Engine _(TUIT-21 → 28, ~2–3 wks)_

- Build `analytics-core` as pure functions first (CAGR, YoY, net-vs-sticker, segmentation, projection) — TDD, edge cases: single data point, all-null range, negative growth, missing prior year.
- Wire the precompute snapshot job (§2.3) + anomaly detection into the QA queue.
- Expose `/api/v1` endpoints (OpenAPI-documented, versioned, auth middleware) + Redis caching.

**Exit criteria:** ✅ batch CAGR for 1,000 institutions <5s · ✅ segment aggregates full-set <10s · ✅ p95 <300ms single-institution under load test · ✅ >70% p95 reduction on cached segment queries · ✅ projections round to nearest $100 and carry methodology labels — no false precision.
**Quality bar:** `analytics-core` holds 100% branch coverage; every "insufficient data" path returns a typed status, never a silent 0 or null.

### Phase 4 — Frontend Dashboard _(TUIT-30 → 37, ~3–4 wks)_

- **Week 1:** typed API client generated from OpenAPI (retry, dedup, global error states) + institution search with URL-state filters.
- **Week 2:** profile page shell (`/institution/[id]`, skeletons, 404s) + Big 5 metric cards with residency toggle + insufficient-data states.
- **Week 3:** trend chart (spike visx vs Recharts against 15-yr dataset → ADR; sticker/net toggle; visible gap rendering) + Provenance Chip wired to live audit-trail timestamps + persistent disclaimer.
- **Week 4:** responsive pass (375/768/1024 — filter drawer, single-column cards, touch-friendly tooltips) + CSV export with metadata header.

**Exit criteria:** ✅ net price + trend render above the fold at 1440px · ✅ toggle re-renders with zero layout shift · ✅ chart legible + interactive at 375px on 2 real devices (iOS + Android) · ✅ export produces valid CSV for sparse-data institutions · ✅ Lighthouse: Performance ≥90, A11y = 100 on profile page.
**Quality bar:** every data-bearing component ships loading, error, empty, _and_ insufficient-data states — reviewed in Storybook before page integration.

### Phase 5 — Launch Hardening _(1 wk)_

- Full a11y audit (keyboard-only walkthrough, screen-reader pass on disclaimer + charts).
- Load test: 100 concurrent users on top-20 institution pages.
- Legal checklist from the scoping doc: disclaimer placement, nominative-use-only institution names (no logos), robots.txt compliance log.
- SEO: per-institution metadata + structured data (the freemium acquisition engine).

**Launch gate:** ✅ zero critical a11y violations · ✅ error budget defined + alerting live · ✅ every public number traceable to an audit-log entry.

---

## Cross-Phase Quality Baselines

| Baseline                              | Enforcement                                                           |
| ------------------------------------- | --------------------------------------------------------------------- |
| No PR without tests for changed logic | CI coverage check on `analytics-core` + `pipeline/etl`                |
| No silent data interpolation, ever    | Typed `insufficient_data` unions, lint-banned `?? 0` on money fields  |
| Every number has provenance           | Schema-level `source_type` + `source_url` NOT NULL on all rate tables |
| Design token discipline               | Stylelint bans raw hex in components — tokens only                    |
| Migration safety                      | Reversibility verified in CI against a staging branch DB              |

**Bottom line (mirrors the scoping doc):** ship v1 on Scorecard/IPEDS + a hand-curated top-100 scraper layer. The data engineering is the long pole — the frontend's job is to make trustworthy data _feel_ trustworthy, and the Provenance Chip is how.
