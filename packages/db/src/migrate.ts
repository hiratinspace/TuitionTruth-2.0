import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "./env";

/**
 * Applies all pending migrations (forward / "up"). Uses a dedicated
 * single-connection client that is closed before exit so the process does not
 * hang on an open pool.
 */
async function main(): Promise<void> {
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder: "./migrations" });
    console.warn("✓ Migrations applied.");
  } finally {
    await migrationClient.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Migration failed:", error);
  process.exit(1);
});
