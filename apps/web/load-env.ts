import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load the monorepo-root `.env` into `process.env`.
 *
 * Next.js loads env files from the app directory (`apps/web`), but this repo
 * keeps a single root `.env` shared by the database package, the Python
 * pipeline, and the web app. Without this, `DATABASE_URL` never reaches the
 * server and every /api/v1 route fails env validation (surfacing to the UI as a
 * network error). Imported first in `next.config.ts`, before env validation.
 *
 * A no-op in CI/production, where the platform injects real environment
 * variables and no root `.env` exists.
 */
const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, "../../.env");

if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}
