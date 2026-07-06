import { and, asc, eq, ilike, type SQL } from "drizzle-orm";
import type { Database } from "../client";
import { institutions, type Institution, type NewInstitution } from "../schema/institutions";
import type { institutionTypeEnum, sectorEnum } from "../schema/enums";

type Sector = (typeof sectorEnum.enumValues)[number];
type InstitutionType = (typeof institutionTypeEnum.enumValues)[number];

export interface SegmentFilter {
  readonly sector?: Sector;
  readonly institutionType?: InstitutionType;
  readonly state?: string;
}

export interface InstitutionSearch {
  /** Case-insensitive substring match on institution name. */
  readonly query?: string;
  readonly sector?: Sector;
  readonly institutionType?: InstitutionType;
  readonly state?: string;
  readonly limit?: number;
}

/**
 * CRUD + query service for institutions. Bulk insert is idempotent on
 * `ipeds_unit_id` so re-running the seed never creates duplicates (TUIT-3 AC #4).
 */
export function createInstitutionRepository(db: Database) {
  return {
    async create(input: NewInstitution): Promise<Institution> {
      const [row] = await db.insert(institutions).values(input).returning();
      if (row === undefined) {
        throw new Error("institutions.create: insert returned no row");
      }
      return row;
    },

    async bulkInsert(rows: readonly NewInstitution[]): Promise<number> {
      if (rows.length === 0) {
        return 0;
      }
      const inserted = await db
        .insert(institutions)
        .values([...rows])
        .onConflictDoNothing({ target: institutions.ipedsUnitId })
        .returning({ id: institutions.id });
      return inserted.length;
    },

    async findByUnitId(ipedsUnitId: number): Promise<Institution | null> {
      const [row] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.ipedsUnitId, ipedsUnitId))
        .limit(1);
      return row ?? null;
    },

    async getById(id: number): Promise<Institution | null> {
      const [row] = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1);
      return row ?? null;
    },

    async listBySegment(filter: SegmentFilter): Promise<Institution[]> {
      const conditions: SQL[] = [];
      if (filter.sector !== undefined) {
        conditions.push(eq(institutions.sector, filter.sector));
      }
      if (filter.institutionType !== undefined) {
        conditions.push(eq(institutions.institutionType, filter.institutionType));
      }
      if (filter.state !== undefined) {
        conditions.push(eq(institutions.state, filter.state));
      }
      return conditions.length > 0
        ? db
            .select()
            .from(institutions)
            .where(and(...conditions))
        : db.select().from(institutions);
    },

    /**
     * Name/segment search for the directory (TUIT-31). Case-insensitive name
     * substring plus optional sector/type/state filters, ordered by name and
     * bounded by `limit` (default 25, hard-capped at 100) so the endpoint can
     * never be coerced into an unbounded scan.
     */
    async search(params: InstitutionSearch): Promise<Institution[]> {
      const conditions: SQL[] = [eq(institutions.isActive, true)];
      if (params.query !== undefined && params.query.trim().length > 0) {
        conditions.push(ilike(institutions.name, `%${params.query.trim()}%`));
      }
      if (params.sector !== undefined) {
        conditions.push(eq(institutions.sector, params.sector));
      }
      if (params.institutionType !== undefined) {
        conditions.push(eq(institutions.institutionType, params.institutionType));
      }
      if (params.state !== undefined) {
        conditions.push(eq(institutions.state, params.state));
      }
      const limit = Math.min(params.limit ?? 25, 100);
      return db
        .select()
        .from(institutions)
        .where(and(...conditions))
        .orderBy(asc(institutions.name))
        .limit(limit);
    },
  };
}

export type InstitutionRepository = ReturnType<typeof createInstitutionRepository>;
