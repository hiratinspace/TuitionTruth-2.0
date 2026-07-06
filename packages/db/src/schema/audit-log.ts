import { sql } from "drizzle-orm";
import { bigserial, check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Immutable, append-only audit trail (TUIT-7). Every insert/update/delete on
 * the tuition, fee, and net-price tables writes one row here per changed field,
 * via a database trigger — the mechanism that lets us defend or correct any
 * disputed figure. Immutability is enforced at the database level (a trigger
 * that rejects UPDATE/DELETE) in the migration, not just by convention.
 *
 * Retention: minimum 7 years, aligned with financial record-keeping norms
 * (documented in docs/data-dictionary.md).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    fieldChanged: text("field_changed").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    // system | scraper | manual — set per-transaction via `SET LOCAL app.actor`.
    changedBy: text("changed_by").notNull().default("system"),
    sourceUrl: text("source_url"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Full history of a single record in <200ms (TUIT-7 AC #4).
    index("audit_log_table_record_idx").on(t.tableName, t.recordId),
    index("audit_log_changed_at_idx").on(t.changedAt),
    check("audit_changed_by_valid", sql`${t.changedBy} in ('system', 'scraper', 'manual')`),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
