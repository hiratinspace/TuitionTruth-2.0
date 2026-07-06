import { defineConfig } from "vitest/config";

/**
 * Unit tests only — pure logic (validation, CSV parsing) that needs no
 * database. These run in the standard `pnpm test` / CI web job.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "node_modules", "dist"],
  },
});
