import { and, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { Database } from "../client";
import type { residencyStatusEnum } from "../schema/enums";
import { institutions } from "../schema/institutions";
import {
  analyticsSnapshots,
  type AnalyticsSnapshot,
  type NewAnalyticsSnapshot,
} from "../schema/analytics-snapshots";
import {
  segmentSnapshots,
  type NewSegmentSnapshot,
  type SegmentSnapshot,
} from "../schema/segment-snapshots";

type ResidencyStatus = (typeof residencyStatusEnum.enumValues)[number];

/** A fully-qualified segment cohort; a `null` dimension means "all". */
export interface SegmentCohort {
  readonly sector: SegmentSnapshot["sector"];
  readonly institutionType: SegmentSnapshot["institutionType"];
  readonly state: string | null;
  readonly residencyStatus: ResidencyStatus;
}

/**
 * Read/write service for the precomputed analytics read-model (§2.3). Writes
 * are upserts keyed on the natural unique constraints so the snapshot job is
 * idempotent — re-running it overwrites in place, never duplicating. Reads are
 * single-row lookups on those same keys, which is what keeps the API request
 * path near-zero-compute (TUIT-27).
 */
export function createAnalyticsSnapshotRepository(db: Database) {
  return {
    /** Idempotently upsert one institution's per-residency snapshot. */
    async upsert(row: NewAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
      const [saved] = await db
        .insert(analyticsSnapshots)
        .values(row)
        .onConflictDoUpdate({
          target: [analyticsSnapshots.institutionId, analyticsSnapshots.residencyStatus],
          set: {
            latestYear: row.latestYear ?? null,
            latestSticker: row.latestSticker ?? null,
            latestNet: row.latestNet ?? null,
            discountRate: row.discountRate ?? null,
            cagr5yr: row.cagr5yr ?? null,
            cagr10yr: row.cagr10yr ?? null,
            yoyRate: row.yoyRate ?? null,
            projectionYear: row.projectionYear ?? null,
            projectionValue: row.projectionValue ?? null,
            payload: row.payload,
            computedAt: new Date(),
          },
        })
        .returning();
      if (saved === undefined) {
        throw new Error("analyticsSnapshots.upsert: insert returned no row");
      }
      return saved;
    },

    /** The single read-model row backing a profile page, or null if not yet computed. */
    async get(
      institutionId: number,
      residencyStatus: ResidencyStatus,
    ): Promise<AnalyticsSnapshot | null> {
      const [row] = await db
        .select()
        .from(analyticsSnapshots)
        .where(
          and(
            eq(analyticsSnapshots.institutionId, institutionId),
            eq(analyticsSnapshots.residencyStatus, residencyStatus),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /** Idempotently upsert one segment cohort's aggregate stats. */
    async upsertSegment(row: NewSegmentSnapshot): Promise<SegmentSnapshot> {
      const [saved] = await db
        .insert(segmentSnapshots)
        .values(row)
        .onConflictDoUpdate({
          target: [
            segmentSnapshots.sector,
            segmentSnapshots.institutionType,
            segmentSnapshots.state,
            segmentSnapshots.residencyStatus,
          ],
          set: {
            institutionCount: row.institutionCount,
            meanSticker: row.meanSticker,
            medianSticker: row.medianSticker,
            minSticker: row.minSticker,
            maxSticker: row.maxSticker,
            computedAt: new Date(),
          },
        })
        .returning();
      if (saved === undefined) {
        throw new Error("segmentSnapshots.upsertSegment: insert returned no row");
      }
      return saved;
    },

    /**
     * The latest-sticker values of every institution in a cohort that has a
     * computed snapshot for the given residency. Feeds the segment aggregation
     * (segmentStats) — reading precomputed scalars rather than recomputing the
     * math, which is what keeps a full-set segment rollup within budget.
     */
    async listCohortStickers(cohort: SegmentCohort): Promise<number[]> {
      const conditions: SQL[] = [
        eq(analyticsSnapshots.residencyStatus, cohort.residencyStatus),
        isNotNull(analyticsSnapshots.latestSticker),
      ];
      if (cohort.sector !== null) {
        conditions.push(eq(institutions.sector, cohort.sector));
      }
      if (cohort.institutionType !== null) {
        conditions.push(eq(institutions.institutionType, cohort.institutionType));
      }
      if (cohort.state !== null) {
        conditions.push(eq(institutions.state, cohort.state));
      }
      const rows = await db
        .select({ sticker: analyticsSnapshots.latestSticker })
        .from(analyticsSnapshots)
        .innerJoin(institutions, eq(analyticsSnapshots.institutionId, institutions.id))
        .where(and(...conditions));
      // `latest_sticker` is filtered NOT NULL in SQL; the type guard re-proves it
      // to TypeScript before parsing each numeric string into a number.
      return rows
        .map((row) => row.sticker)
        .filter((sticker): sticker is string => sticker !== null)
        .map(Number);
    },

    /** Read one precomputed segment cohort, or null if not yet computed. */
    async getSegment(cohort: SegmentCohort): Promise<SegmentSnapshot | null> {
      const conditions: SQL[] = [
        eq(segmentSnapshots.residencyStatus, cohort.residencyStatus),
        cohort.sector === null
          ? isNull(segmentSnapshots.sector)
          : eq(segmentSnapshots.sector, cohort.sector),
        cohort.institutionType === null
          ? isNull(segmentSnapshots.institutionType)
          : eq(segmentSnapshots.institutionType, cohort.institutionType),
        cohort.state === null
          ? isNull(segmentSnapshots.state)
          : eq(segmentSnapshots.state, cohort.state),
      ];
      const [row] = await db
        .select()
        .from(segmentSnapshots)
        .where(and(...conditions))
        .limit(1);
      return row ?? null;
    },
  };
}

export type AnalyticsSnapshotRepository = ReturnType<typeof createAnalyticsSnapshotRepository>;
