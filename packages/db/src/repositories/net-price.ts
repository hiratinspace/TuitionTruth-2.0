import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { netPriceData, type NetPrice } from "../schema/net-price-data";

/**
 * Read service for net-price history. The analytics precompute reads the
 * aggregate series (the `income_bracket IS NULL` rows — the institution-wide
 * average, not an income-segmented slice), oldest year first, mirroring the
 * ordering contract of the tuition repository.
 */
export function createNetPriceRepository(db: Database) {
  return {
    /** Aggregate net-price series for an institution, oldest year first. */
    async getAggregateHistory(institutionId: number): Promise<NetPrice[]> {
      return db
        .select()
        .from(netPriceData)
        .where(
          and(eq(netPriceData.institutionId, institutionId), isNull(netPriceData.incomeBracket)),
        )
        .orderBy(asc(netPriceData.academicYear));
    },
  };
}

export type NetPriceRepository = ReturnType<typeof createNetPriceRepository>;
