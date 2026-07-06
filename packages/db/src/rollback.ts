import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { env } from "./env";

/**
 * Rolls back the most recently applied migration.
 *
 * Drizzle migrations are forward-only by design, so reversibility is a project
 * convention (docs/BUILD_PLAN.md, Phase 1 quality bar): every generated
 * `NNNN_name.sql` ships a hand-authored `NNNN_name.down.sql`. This script finds
 * the latest applied migration from the journal, runs its down companion, and
 * removes the journal row — all in a single transaction so a failure leaves the
 * database untouched.
 */
interface JournalEntry {
  readonly idx: number;
  readonly version: string;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

interface Journal {
  readonly version: string;
  readonly dialect: string;
  readonly entries: readonly JournalEntry[];
}

async function main(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const last = journal.entries.at(-1);

  if (last === undefined) {
    console.warn("No migrations to roll back.");
    return;
  }

  const downPath = path.join(migrationsDir, `${last.tag}.down.sql`);
  let downSql: string;
  try {
    downSql = readFileSync(downPath, "utf8");
  } catch {
    throw new Error(
      `Missing reversible companion "${last.tag}.down.sql". ` +
        "Every migration must ship a tested down.sql (Phase 1 quality bar).",
    );
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(downSql);
      await tx.unsafe(
        'DELETE FROM drizzle."__drizzle_migrations" ' +
          'WHERE id = (SELECT max(id) FROM drizzle."__drizzle_migrations")',
      );
    });
    console.warn(`✓ Rolled back migration "${last.tag}".`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Rollback failed:", error);
  process.exit(1);
});
