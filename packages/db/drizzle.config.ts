import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * Reads DATABASE_URL directly from the environment (not the validated `env`
 * module) so that offline commands — `generate` and `check` — run without a
 * live database. `migrate` supplies a real URL at runtime.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://tuitiontruth:tuitiontruth@localhost:5432/tuitiontruth",
  },
  strict: true,
  verbose: true,
});
