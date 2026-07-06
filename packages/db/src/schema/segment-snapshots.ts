import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { institutionTypeEnum, residencyStatusEnum, sectorEnum } from "./enums";

/**
 * Precomputed segment aggregates (§2.3, TUIT-27/28). A segment is a cohort
 * defined by any combination of sector, institution type, and state; a NULL
 * dimension means "all" (a NULL state is the national rollup). Stats describe
 * the distribution of the latest sticker price across institutions in the
 * cohort — median leads because tuition distributions are right-skewed.
 *
 * Rebuilt by the snapshot job alongside per-institution rows and cached in
 * Redis by the API (TUIT-28), which is what lets segment queries hit the >70%
 * p95-reduction target without recomputing across thousands of institutions.
 */
export const segmentSnapshots = pgTable(
  "segment_snapshots",
  {
    id: serial("id").primaryKey(),
    sector: sectorEnum("sector"),
    institutionType: institutionTypeEnum("institution_type"),
    state: varchar("state", { length: 2 }),
    residencyStatus: residencyStatusEnum("residency_status").notNull(),
    institutionCount: integer("institution_count").notNull(),
    meanSticker: numeric("mean_sticker", { precision: 12, scale: 2 }).notNull(),
    medianSticker: numeric("median_sticker", { precision: 12, scale: 2 }).notNull(),
    minSticker: numeric("min_sticker", { precision: 12, scale: 2 }).notNull(),
    maxSticker: numeric("max_sticker", { precision: 12, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per fully-qualified cohort. NULLS NOT DISTINCT so the "all
    // sectors / national" rollups are each unique despite their NULL dimensions.
    unique("segment_snapshots_cohort_key")
      .on(t.sector, t.institutionType, t.state, t.residencyStatus)
      .nullsNotDistinct(),
    index("segment_snapshots_lookup_idx").on(t.residencyStatus, t.state),
    check("segment_snapshots_count_positive", sql`${t.institutionCount} > 0`),
    check(
      "segment_snapshots_sticker_ordering",
      sql`${t.minSticker} <= ${t.medianSticker} and ${t.medianSticker} <= ${t.maxSticker}`,
    ),
  ],
);

export type SegmentSnapshot = typeof segmentSnapshots.$inferSelect;
export type NewSegmentSnapshot = typeof segmentSnapshots.$inferInsert;
