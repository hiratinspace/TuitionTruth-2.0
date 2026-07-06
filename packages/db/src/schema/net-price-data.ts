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
import { institutions } from "./institutions";

/**
 * Average institutional aid and calculated net price, kept distinct from
 * sticker price (TUIT-6) because the two series can diverge sharply. Amounts
 * are nullable: an institution that reports no aid yields an explicit null,
 * which the analytics layer surfaces as "insufficient data" rather than
 * silently falling back to sticker price. `income_bracket` is nullable to
 * support both aggregate and income-segmented records.
 */
export const netPriceData = pgTable(
  "net_price_data",
  {
    id: serial("id").primaryKey(),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    academicYear: integer("academic_year").notNull(),
    incomeBracket: text("income_bracket"),
    averageAidAmount: numeric("average_aid_amount", { precision: 12, scale: 2 }),
    netPriceAmount: numeric("net_price_amount", { precision: 12, scale: 2 }),
    dataSource: text("data_source"),
    effectiveDate: date("effective_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NULLS NOT DISTINCT so the aggregate (null bracket) row is unique per year.
    unique("net_price_inst_year_bracket_key")
      .on(t.institutionId, t.academicYear, t.incomeBracket)
      .nullsNotDistinct(),
    index("net_price_inst_year_idx").on(t.institutionId, t.academicYear),
    check(
      "net_price_amounts_non_negative",
      sql`(${t.averageAidAmount} is null or ${t.averageAidAmount} >= 0) and (${t.netPriceAmount} is null or ${t.netPriceAmount} >= 0)`,
    ),
    check("net_price_academic_year_range", sql`${t.academicYear} between 1990 and 2100`),
  ],
);

export type NetPrice = typeof netPriceData.$inferSelect;
export type NewNetPrice = typeof netPriceData.$inferInsert;
