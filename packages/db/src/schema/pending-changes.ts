import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * QA review queue (TUIT-18). The diffing engine writes flagged changes here as
 * `pending`; a human operator approves (committing the value to the canonical
 * tables) or rejects (archived with a reason, never deleted). This is the only
 * human write-path into production data.
 */
export const pendingChanges = pgTable(
  "pending_changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind").notNull(),
    tableName: text("table_name").notNull(),
    ipedsUnitId: integer("ipeds_unit_id").notNull(),
    academicYear: integer("academic_year").notNull(),
    residencyStatus: text("residency_status"),
    fieldChanged: text("field_changed").notNull(),
    oldValue: numeric("old_value", { precision: 12, scale: 2 }),
    newValue: numeric("new_value", { precision: 12, scale: 2 }).notNull(),
    sourceUrl: text("source_url"),
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    explanation: text("explanation").notNull(),
    status: text("status").notNull().default("pending"),
    reviewer: text("reviewer"),
    rejectionReason: text("rejection_reason"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("pending_changes_status_idx").on(t.status),
    index("pending_changes_inst_idx").on(t.ipedsUnitId),
    check("pending_changes_status_valid", sql`${t.status} in ('pending', 'approved', 'rejected')`),
  ],
);

export type PendingChangeRow = typeof pendingChanges.$inferSelect;
export type NewPendingChangeRow = typeof pendingChanges.$inferInsert;
