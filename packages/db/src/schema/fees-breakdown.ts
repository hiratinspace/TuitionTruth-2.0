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
} from "drizzle-orm/pg-core";
import { feeTypeEnum } from "./enums";
import { institutions } from "./institutions";

/**
 * Mandatory fees, room, board, and other cost components stored separately from
 * base tuition (TUIT-5) so total cost of attendance can be tracked independent
 * of how each institution labels its line items. One row per
 * (institution, year, fee_type); multiple fee types per year is expected.
 */
export const feesBreakdown = pgTable(
  "fees_breakdown",
  {
    id: serial("id").primaryKey(),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    academicYear: integer("academic_year").notNull(),
    feeType: feeTypeEnum("fee_type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    effectiveDate: date("effective_date"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("fees_inst_year_type_key").on(t.institutionId, t.academicYear, t.feeType),
    index("fees_inst_year_idx").on(t.institutionId, t.academicYear),
    check("fee_amount_non_negative", sql`${t.amount} >= 0`),
    check("fee_academic_year_range", sql`${t.academicYear} between 1990 and 2100`),
  ],
);

export type FeeBreakdown = typeof feesBreakdown.$inferSelect;
export type NewFeeBreakdown = typeof feesBreakdown.$inferInsert;
