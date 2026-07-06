import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * Permanent readiness-probe table (introduced in migration 0000). Its presence
 * proves the migration pipeline reached the database; health checks touch a
 * trivially cheap row here.
 */
export const migrationHealth = pgTable("migration_health", {
  id: serial("id").primaryKey(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MigrationHealth = typeof migrationHealth.$inferSelect;
export type NewMigrationHealth = typeof migrationHealth.$inferInsert;
