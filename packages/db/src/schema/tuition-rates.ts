import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { residencyStatusEnum, sourceTypeEnum } from "./enums";
import { institutions } from "./institutions";

/**
 * Year-over-year tuition figures per institution, segmented by residency
 * (TUIT-4). `academic_year` stores the start year — 2024 denotes the 2024–25
 * academic year. Amounts are `numeric` (exact) not float, because this is
 * money. FK is ON DELETE RESTRICT: you cannot delete an institution out from
 * under its historical record.
 */
export const tuitionRates = pgTable(
  "tuition_rates",
  {
    id: serial("id").primaryKey(),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    academicYear: integer("academic_year").notNull(),
    residencyStatus: residencyStatusEnum("residency_status").notNull(),
    tuitionAmount: numeric("tuition_amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    effectiveDate: date("effective_date"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One figure per institution/year/residency (TUIT-4 AC #2).
    unique("tuition_rates_inst_year_residency_key").on(
      t.institutionId,
      t.academicYear,
      t.residencyStatus,
    ),
    // Fast historical lookups (TUIT-4 AC #4).
    index("tuition_rates_inst_year_idx").on(t.institutionId, t.academicYear),
    // Financial-integrity guards (TUIT-9 AC #1).
    check("tuition_amount_positive", sql`${t.tuitionAmount} > 0`),
    check("tuition_academic_year_range", sql`${t.academicYear} between 1990 and 2100`),
    check(
      "tuition_confidence_range",
      sql`${t.confidenceScore} is null or (${t.confidenceScore} >= 0 and ${t.confidenceScore} <= 1)`,
    ),
  ],
);

export type TuitionRate = typeof tuitionRates.$inferSelect;
export type NewTuitionRate = typeof tuitionRates.$inferInsert;
