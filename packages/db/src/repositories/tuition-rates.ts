import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { tuitionRates, type TuitionRate } from "../schema/tuition-rates";
import type { residencyStatusEnum } from "../schema/enums";
import { validateTuitionRate } from "../validation";

type ResidencyStatus = (typeof residencyStatusEnum.enumValues)[number];

/**
 * Service for tuition figures. Every write passes through `validateTuitionRate`
 * first (TUIT-9), so a malformed payload is rejected in the application layer
 * before hitting the database. `numeric` columns are written as strings to
 * preserve exact precision — money is never a float.
 */
export function createTuitionRateRepository(db: Database) {
  return {
    async insertValidated(input: unknown): Promise<TuitionRate> {
      const v = validateTuitionRate(input);
      const [row] = await db
        .insert(tuitionRates)
        .values({
          institutionId: v.institutionId,
          academicYear: v.academicYear,
          residencyStatus: v.residencyStatus,
          tuitionAmount: v.tuitionAmount.toFixed(2),
          currency: v.currency,
          ...(v.effectiveDate !== undefined ? { effectiveDate: v.effectiveDate } : {}),
          sourceType: v.sourceType,
          ...(v.sourceUrl !== undefined ? { sourceUrl: v.sourceUrl } : {}),
          ...(v.confidenceScore !== undefined
            ? { confidenceScore: v.confidenceScore.toFixed(2) }
            : {}),
        })
        .returning();
      if (row === undefined) {
        throw new Error("tuitionRates.insertValidated: insert returned no row");
      }
      return row;
    },

    /** Historical series for an institution + residency, oldest year first. */
    async getHistory(
      institutionId: number,
      residencyStatus: ResidencyStatus,
    ): Promise<TuitionRate[]> {
      return db
        .select()
        .from(tuitionRates)
        .where(
          and(
            eq(tuitionRates.institutionId, institutionId),
            eq(tuitionRates.residencyStatus, residencyStatus),
          ),
        )
        .orderBy(asc(tuitionRates.academicYear));
    },
  };
}

export type TuitionRateRepository = ReturnType<typeof createTuitionRateRepository>;
