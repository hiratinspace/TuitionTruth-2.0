import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { institutionTypeEnum, sectorEnum } from "./enums";

/**
 * The parent entity. Every tuition, fee, and aid record references an
 * institution via foreign key (TUIT-3). `ipeds_unit_id` is the natural key used
 * to deduplicate across data sources.
 */
export const institutions = pgTable(
  "institutions",
  {
    id: serial("id").primaryKey(),
    ipedsUnitId: integer("ipeds_unit_id").notNull(),
    opeid: varchar("opeid", { length: 8 }),
    name: text("name").notNull(),
    city: text("city"),
    state: varchar("state", { length: 2 }).notNull(),
    sector: sectorEnum("sector").notNull(),
    institutionType: institutionTypeEnum("institution_type").notNull(),
    websiteUrl: text("website_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Prevents duplicate institution records across ingestion sources (TUIT-3 AC #2).
    uniqueIndex("institutions_ipeds_unit_id_key").on(t.ipedsUnitId),
    index("institutions_state_idx").on(t.state),
    // Segmentation composite: sector + type + state (TUIT-8 AC #2).
    index("institutions_segment_idx").on(t.sector, t.institutionType, t.state),
  ],
);

export type Institution = typeof institutions.$inferSelect;
export type NewInstitution = typeof institutions.$inferInsert;
