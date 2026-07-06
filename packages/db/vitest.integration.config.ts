import { defineConfig } from "vitest/config";

/**
 * Integration tests — exercise a live Postgres (DATABASE_URL). Run via
 * `pnpm --filter @tuitiontruth/db test:integration` locally against
 * docker-compose, and in a dedicated CI job with a Postgres service container.
 * Serialized (no file parallelism) because tests share schema-level state.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
