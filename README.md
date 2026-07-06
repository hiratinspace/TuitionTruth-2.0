# TuitionTruth 2.0

College tuition tracking and inflation analysis. **What will this degree actually cost me, and how fast is that number rising?**

Every number the platform displays carries visible provenance — source, timestamp, confidence. Architecture decisions are recorded in [`docs/decisions/`](docs/decisions).

## Monorepo layout

| Path                      | Package                        | Responsibility                                                              |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `apps/web`                | `@tuitiontruth/web`            | Next.js 15 — user-facing UI + `/api/v1` analytics endpoints                 |
| `apps/pipeline`           | —                              | Python 3.12 ingestion service (Scorecard / IPEDS / scrapers / ETL)          |
| `packages/db`             | `@tuitiontruth/db`             | Drizzle schema + migrations — the single source of truth for the data model |
| `packages/analytics-core` | `@tuitiontruth/analytics-core` | Pure, I/O-free tuition math (CAGR, YoY, projections)                        |
| `packages/ui`             | `@tuitiontruth/ui`             | Design system: tokens + primitives                                          |
| `packages/config`         | `@tuitiontruth/config`         | Shared TypeScript + ESLint configuration                                    |

Data flows one direction: **pipeline → db → analytics API → UI**. UI never touches the database directly.

## Prerequisites

- **Node** ≥ 22.13 (`.nvmrc` pins the dev version)
- **pnpm** ≥ 9 — `corepack enable && corepack prepare pnpm@9.15.0 --activate`
- **Docker** (for the local Postgres + Redis, optional but recommended)
- **Python** 3.12 (for `apps/pipeline`)

## Getting started

```bash
pnpm install                              # install all workspace dependencies
cp .env.example .env                       # local defaults already point at docker compose
docker compose up -d                       # start local Postgres + Redis
pnpm db:migrate                            # apply migrations
pnpm --filter @tuitiontruth/web seed:dev   # load demo institutions + tuition history + snapshots
pnpm --filter @tuitiontruth/web dev        # run the web app at http://localhost:3000
```

Then open <http://localhost:3000>, search for a college (e.g. "university"), and open its profile
to see net price, the cost trend, and the projected total.

The root `.env` is shared by the database package, the pipeline, and the web app; every command
above loads it automatically (the web app via `next.config.ts`, the CLI scripts via
`--env-file-if-exists`), so no manual `export` is needed.

> **Demo vs. real data.** `seed:dev` inserts a hand-curated sample so the app runs without API keys.
> Production data comes from `apps/pipeline` (College Scorecard + IPEDS + scraped current-year
> prices); set `COLLEGE_SCORECARD_API_KEY` in `.env` to run live ingestion.

## Common commands

| Command          | Effect                                      |
| ---------------- | ------------------------------------------- |
| `pnpm build`     | Build every package/app (`turbo run build`) |
| `pnpm typecheck` | Strict `tsc --noEmit` across the workspace  |
| `pnpm lint`      | ESLint across the workspace                 |
| `pnpm test`      | Run unit tests (`turbo run test`)           |
| `pnpm format`    | Prettier write                              |

## Database migrations (TUIT-2)

Schema lives in `packages/db/src/schema`. Migrations are **forward-first with an explicit, reversible companion** — every generated `NNNN_name.sql` ships with a hand-authored `NNNN_name.down.sql`, so no schema change reaches `main` without a tested rollback (the Phase 1 quality bar).

```bash
# Generate a new migration from schema changes (no database required):
pnpm db:generate

# Apply all pending migrations (requires DATABASE_URL):
pnpm db:migrate

# Roll back the most recently applied migration:
pnpm db:rollback

# Verify migration files are internally consistent (drift check, no DB required):
pnpm db:check
```

CI proves reversibility on every PR by running `migrate → rollback → migrate` against a disposable Postgres service container.

> Run migrations locally against `docker compose` Postgres; run them in CI/staging against a Neon branch. Never point `db:migrate` at production without a reviewed migration + its verified `down.sql`.
