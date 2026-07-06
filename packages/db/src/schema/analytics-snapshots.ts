import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { residencyStatusEnum } from "./enums";
import { institutions } from "./institutions";

/**
 * The JSON shape of one precomputed metric, mirroring `analytics-core`'s
 * `Metric<T>` discriminated union at the serialization boundary. Declared here
 * — rather than imported from `analytics-core` — so `packages/db` stays a pure
 * schema package with no dependency on business-logic code (§1.4). The
 * precompute job is responsible for producing values assignable to this shape.
 */
export type MetricJson<T = unknown> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "insufficient_data"; readonly reason: string };

/**
 * The full serialized `InstitutionAnalytics` payload. Every headline metric is
 * a `MetricJson`, so an institution missing a decade of history still stores a
 * complete, well-formed row — its gaps are explicit `insufficient_data` states,
 * never absent keys the API would have to guess about.
 */
/** One observation in a stored series (already parsed from `numeric`). */
export interface SeriesPointJson {
  readonly year: number;
  readonly value: number;
}

export interface AnalyticsSnapshotPayload {
  readonly latestSticker: MetricJson<number>;
  readonly latestNet: MetricJson<number>;
  readonly discount: MetricJson;
  readonly cagr5yr: MetricJson;
  readonly cagr10yr: MetricJson;
  readonly yoy: MetricJson;
  readonly projection: MetricJson;
  /** Full sticker/net histories the trend chart renders (§2.3, TUIT-34). */
  readonly stickerSeries: readonly SeriesPointJson[];
  readonly netSeries: readonly SeriesPointJson[];
}

/**
 * Precomputed analytics read-model (§2.3, TUIT-27). One flat, indexed row per
 * institution + residency, rebuilt by the snapshot job after every ETL run and
 * QA approval. The request path reads exactly one row by `(institution_id,
 * residency_status)` — near-zero compute, p95 well under the 300ms target.
 *
 * The scalar columns (`latest_sticker`, `cagr_5yr`, …) exist for sorting,
 * filtering, and segment rollups without deserializing JSON; the `payload`
 * column carries the complete typed `Metric` union — including the reasons
 * behind every `insufficient_data` state — that the profile page renders.
 * Scalars are nullable precisely because a metric may be `insufficient_data`;
 * they are never a stand-in `0`.
 */
export const analyticsSnapshots = pgTable(
  "analytics_snapshots",
  {
    id: serial("id").primaryKey(),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    residencyStatus: residencyStatusEnum("residency_status").notNull(),
    latestYear: integer("latest_year"),
    latestSticker: numeric("latest_sticker", { precision: 12, scale: 2 }),
    latestNet: numeric("latest_net", { precision: 12, scale: 2 }),
    discountRate: numeric("discount_rate", { precision: 9, scale: 6 }),
    cagr5yr: numeric("cagr_5yr", { precision: 9, scale: 6 }),
    cagr10yr: numeric("cagr_10yr", { precision: 9, scale: 6 }),
    yoyRate: numeric("yoy_rate", { precision: 9, scale: 6 }),
    projectionYear: integer("projection_year"),
    projectionValue: numeric("projection_value", { precision: 12, scale: 2 }),
    payload: jsonb("payload").$type<AnalyticsSnapshotPayload>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One snapshot per institution/residency — the read key (TUIT-27).
    unique("analytics_snapshots_inst_residency_key").on(t.institutionId, t.residencyStatus),
    // Segment rollups scan sticker within a sector/type/state cohort.
    index("analytics_snapshots_sticker_idx").on(t.latestSticker),
    check(
      "analytics_snapshots_latest_year_range",
      sql`${t.latestYear} is null or ${t.latestYear} between 1990 and 2100`,
    ),
  ],
);

export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;
export type NewAnalyticsSnapshot = typeof analyticsSnapshots.$inferInsert;
