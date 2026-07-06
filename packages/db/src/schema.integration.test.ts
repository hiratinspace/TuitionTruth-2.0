import { and, avg, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInstitutionRepository } from "./repositories/institutions";
import { createTuitionRateRepository } from "./repositories/tuition-rates";
import * as schema from "./schema";
import { auditLog, feesBreakdown, institutions, netPriceData, tuitionRates } from "./schema";
import type { NewInstitution } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (DATABASE_URL === undefined) {
  throw new Error("Integration tests require DATABASE_URL (start docker compose).");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });
const institutionRepo = createInstitutionRepository(db);
const tuitionRepo = createTuitionRateRepository(db);

async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE tuition_rates, fees_breakdown, net_price_data, audit_log, institutions RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  // Fail loudly if migrations haven't been applied.
  await db.execute(sql`SELECT 1 FROM institutions LIMIT 1`);
  await truncateAll();
});

afterAll(async () => {
  await client.end();
});

describe("institutions (TUIT-3)", () => {
  it("round-trips a created institution by IPEDS unit id", async () => {
    await truncateAll();
    const created = await institutionRepo.create({
      ipedsUnitId: 111111,
      name: "Test State University",
      state: "CA",
      sector: "public",
      institutionType: "four_year",
    });
    const found = await institutionRepo.findByUnitId(111111);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("Test State University");
  });

  it("dedupes on ipeds_unit_id during bulk insert (idempotent seed)", async () => {
    await truncateAll();
    const first = await institutionRepo.bulkInsert([
      {
        ipedsUnitId: 222222,
        name: "A",
        state: "TX",
        sector: "public",
        institutionType: "two_year",
      },
    ]);
    const second = await institutionRepo.bulkInsert([
      {
        ipedsUnitId: 222222,
        name: "A dup",
        state: "TX",
        sector: "public",
        institutionType: "two_year",
      },
    ]);
    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("filters by segment", async () => {
    await truncateAll();
    await institutionRepo.bulkInsert([
      {
        ipedsUnitId: 1,
        name: "Pub4 CA",
        state: "CA",
        sector: "public",
        institutionType: "four_year",
      },
      {
        ipedsUnitId: 2,
        name: "Priv4 CA",
        state: "CA",
        sector: "private",
        institutionType: "four_year",
      },
      {
        ipedsUnitId: 3,
        name: "Pub2 TX",
        state: "TX",
        sector: "public",
        institutionType: "two_year",
      },
    ]);
    const pubCa = await institutionRepo.listBySegment({ sector: "public", state: "CA" });
    expect(pubCa).toHaveLength(1);
    expect(pubCa[0]?.ipedsUnitId).toBe(1);
  });
});

describe("tuition_rates constraints (TUIT-4, TUIT-9)", () => {
  it("stores validated history in chronological order", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 333333,
      name: "History U",
      state: "NY",
      sector: "public",
      institutionType: "four_year",
    });
    for (const [year, amount] of [
      [2022, 10000],
      [2020, 8000],
      [2021, 9000],
    ] as const) {
      await tuitionRepo.insertValidated({
        institutionId: inst.id,
        academicYear: year,
        residencyStatus: "in_state",
        tuitionAmount: amount,
        sourceType: "api",
      });
    }
    const history = await tuitionRepo.getHistory(inst.id, "in_state");
    expect(history.map((h) => h.academicYear)).toEqual([2020, 2021, 2022]);
  });

  it("rejects a duplicate (institution, year, residency)", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 444444,
      name: "Dup U",
      state: "FL",
      sector: "private",
      institutionType: "four_year",
    });
    const payload = {
      institutionId: inst.id,
      academicYear: 2024,
      residencyStatus: "in_state",
      tuitionAmount: 5000,
      sourceType: "api",
    };
    await tuitionRepo.insertValidated(payload);
    await expect(tuitionRepo.insertValidated(payload)).rejects.toThrow();
  });

  it("enforces the positive-amount CHECK at the database (defense in depth)", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 555555,
      name: "Check U",
      state: "IL",
      sector: "public",
      institutionType: "four_year",
    });
    // Bypass the app-layer validator and hit the raw DB constraint directly.
    await expect(
      db.insert(tuitionRates).values({
        institutionId: inst.id,
        academicYear: 2024,
        residencyStatus: "in_state",
        tuitionAmount: "-500.00",
        sourceType: "manual",
      }),
    ).rejects.toThrow();
  });

  it("blocks deleting an institution that still has tuition rows (ON DELETE RESTRICT)", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 666666,
      name: "Restrict U",
      state: "OH",
      sector: "public",
      institutionType: "four_year",
    });
    await tuitionRepo.insertValidated({
      institutionId: inst.id,
      academicYear: 2024,
      residencyStatus: "in_state",
      tuitionAmount: 7000,
      sourceType: "api",
    });
    await expect(db.delete(institutions).where(eq(institutions.id, inst.id))).rejects.toThrow();
  });
});

describe("net_price null handling (TUIT-6)", () => {
  it("accepts a record with no reported aid (explicit nulls, not zero)", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 777777,
      name: "NoAid U",
      state: "GA",
      sector: "private",
      institutionType: "four_year",
    });
    await db.insert(netPriceData).values({
      institutionId: inst.id,
      academicYear: 2024,
      dataSource: "scorecard",
    });
    const [row] = await db
      .select()
      .from(netPriceData)
      .where(eq(netPriceData.institutionId, inst.id));
    expect(row?.averageAidAmount).toBeNull();
    expect(row?.netPriceAmount).toBeNull();
  });
});

describe("audit trail (TUIT-7)", () => {
  it("records a field-level change when a tuition value is updated", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 888888,
      name: "Audit U",
      state: "PA",
      sector: "public",
      institutionType: "four_year",
    });
    const rate = await tuitionRepo.insertValidated({
      institutionId: inst.id,
      academicYear: 2024,
      residencyStatus: "in_state",
      tuitionAmount: 10000,
      sourceType: "api",
    });
    await db
      .update(tuitionRates)
      .set({ tuitionAmount: "11000.00" })
      .where(eq(tuitionRates.id, rate.id));

    const changes = await db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.tableName, "tuition_rates"), eq(auditLog.fieldChanged, "tuition_amount")),
      );
    const updateEntry = changes.find((c) => c.oldValue === "10000.00" && c.newValue === "11000.00");
    expect(updateEntry).toBeDefined();
    expect(updateEntry?.recordId).toBe(String(rate.id));
  });

  it("attributes the change to the session actor via app.actor", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 999999,
      name: "Actor U",
      state: "MI",
      sector: "public",
      institutionType: "four_year",
    });
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL app.actor = 'scraper'`);
      await tx.insert(tuitionRates).values({
        institutionId: inst.id,
        academicYear: 2024,
        residencyStatus: "in_state",
        tuitionAmount: "12000.00",
        sourceType: "scrape",
      });
    });
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.tableName, "tuition_rates"), eq(auditLog.fieldChanged, "tuition_amount")),
      )
      .limit(1);
    expect(entry?.changedBy).toBe("scraper");
  });

  it("is append-only: UPDATE and DELETE are rejected at the database", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 101010,
      name: "Immutable U",
      state: "NC",
      sector: "public",
      institutionType: "four_year",
    });
    await tuitionRepo.insertValidated({
      institutionId: inst.id,
      academicYear: 2024,
      residencyStatus: "in_state",
      tuitionAmount: 9000,
      sourceType: "api",
    });
    await expect(
      db
        .update(auditLog)
        .set({ newValue: "tampered" })
        .where(eq(auditLog.tableName, "tuition_rates")),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.delete(auditLog).where(eq(auditLog.tableName, "tuition_rates")),
    ).rejects.toThrow(/append-only/);
  });
});

describe("total_mandatory_cost view (TUIT-5)", () => {
  it("sums tuition and mandatory fees per institution/year/residency", async () => {
    await truncateAll();
    const inst = await institutionRepo.create({
      ipedsUnitId: 121212,
      name: "Cost U",
      state: "WA",
      sector: "public",
      institutionType: "four_year",
    });
    await tuitionRepo.insertValidated({
      institutionId: inst.id,
      academicYear: 2024,
      residencyStatus: "in_state",
      tuitionAmount: 10000,
      sourceType: "api",
    });
    await db.insert(feesBreakdown).values([
      { institutionId: inst.id, academicYear: 2024, feeType: "mandatory_fee", amount: "1500.00" },
      { institutionId: inst.id, academicYear: 2024, feeType: "room", amount: "8000.00" },
    ]);
    const [row] = await db.execute<{ total_mandatory_cost: string; mandatory_fees: string }>(
      sql`SELECT total_mandatory_cost, mandatory_fees FROM total_mandatory_cost WHERE institution_id = ${inst.id}`,
    );
    // Only mandatory_fee counts toward mandatory cost — room is excluded.
    expect(Number(row?.mandatory_fees)).toBe(1500);
    expect(Number(row?.total_mandatory_cost)).toBe(11500);
  });
});

describe("query performance on a seeded dataset (TUIT-4, TUIT-8)", () => {
  const INSTITUTIONS = 6000;
  const HISTORY_YEARS = 15;

  beforeAll(async () => {
    await truncateAll();
    // Bulk-load with audit triggers disabled — we are measuring read latency,
    // not the (already-tested) audit write path. Requires superuser (docker default).
    await db.execute(sql`SET session_replication_role = replica`);
    const rows = Array.from({ length: INSTITUTIONS }, (_, i): NewInstitution => ({
      ipedsUnitId: 900000 + i,
      name: `Perf University ${String(i)}`,
      state: ["CA", "TX", "NY", "FL", "IL"][i % 5] ?? "CA",
      sector: i % 2 === 0 ? "public" : "private",
      institutionType: i % 3 === 0 ? "two_year" : "four_year",
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      await institutionRepo.bulkInsert(rows.slice(i, i + 1000));
    }
    const allInst = await db.select({ id: institutions.id }).from(institutions);
    const firstId = allInst[0]?.id ?? 1;

    const tuition: (typeof tuitionRates.$inferInsert)[] = [];
    // Two residency rows per institution for 2024 (>10k rows total).
    for (const { id } of allInst) {
      tuition.push({
        institutionId: id,
        academicYear: 2024,
        residencyStatus: "in_state",
        tuitionAmount: "12000.00",
        sourceType: "api",
      });
      tuition.push({
        institutionId: id,
        academicYear: 2024,
        residencyStatus: "out_of_state",
        tuitionAmount: "30000.00",
        sourceType: "api",
      });
    }
    // A deep 15-year history for the first institution (dashboard trend query).
    for (let y = 0; y < HISTORY_YEARS; y += 1) {
      tuition.push({
        institutionId: firstId,
        academicYear: 2009 + y,
        residencyStatus: "in_state",
        tuitionAmount: String(8000 + y * 300),
        sourceType: "api",
      });
    }
    for (let i = 0; i < tuition.length; i += 1000) {
      await db.insert(tuitionRates).values(tuition.slice(i, i + 1000));
    }
    await db.execute(sql`SET session_replication_role = origin`);
    await db.execute(sql`ANALYZE institutions, tuition_rates`);
  });

  async function timed<T>(fn: () => Promise<T>): Promise<number> {
    await fn(); // warm plan/cache
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
  }

  it("has >10k tuition rows seeded", async () => {
    const countResult = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM tuition_rates`,
    );
    expect(Number(countResult[0]?.count ?? "0")).toBeGreaterThan(10_000);
  });

  it("runs a single-institution trend query in under 100ms", async () => {
    const firstRows = await db.select({ id: institutions.id }).from(institutions).limit(1);
    const firstId = firstRows[0]?.id ?? 1;
    const ms = await timed(() => tuitionRepo.getHistory(firstId, "in_state"));
    console.warn(`[perf] single-institution trend query: ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(100);
  });

  it("runs a segment aggregate in under 100ms", async () => {
    const ms = await timed(() =>
      db
        .select({ avgTuition: avg(tuitionRates.tuitionAmount) })
        .from(tuitionRates)
        .innerJoin(institutions, eq(institutions.id, tuitionRates.institutionId))
        .where(
          and(
            eq(institutions.sector, "public"),
            eq(institutions.institutionType, "four_year"),
            eq(tuitionRates.residencyStatus, "in_state"),
          ),
        ),
    );
    console.warn(`[perf] segment aggregate query: ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(100);
  });
});
