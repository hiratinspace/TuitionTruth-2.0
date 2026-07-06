import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Server-logic tests for the web app. The `@` alias mirrors tsconfig; a dummy
 * DATABASE_URL lets modules that transitively import @tuitiontruth/db load
 * without a live database (postgres.js connects lazily, on first query, so no
 * connection is opened during these pure-function tests).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/tuitiontruth_test",
    },
  },
});
