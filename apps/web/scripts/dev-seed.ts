/**
 * Development seed — populates a working demo dataset end to end.
 *
 * The production data path is the Python ingestion pipeline (Scorecard + IPEDS +
 * scraping). For local development without API keys, this script inserts a small
 * set of recognizable institutions with 15 years of plausible tuition/net-price
 * history, then runs the same precompute the ETL would, so search AND profile
 * pages render real numbers, trends, and projections.
 *
 * Idempotent: institutions dedupe on ipeds_unit_id; rate/net rows use
 * ON CONFLICT DO NOTHING; snapshots upsert.
 *
 *   docker compose up -d postgres
 *   pnpm --filter @tuitiontruth/db migrate
 *   pnpm --filter @tuitiontruth/web seed:dev
 */
import {
  createInstitutionRepository,
  db,
  netPriceData,
  tuitionRates,
  type NewInstitution,
} from "@tuitiontruth/db";
import { recomputeInstitution, recomputeSegment } from "../src/server/analytics/precompute";

interface SeedSpec {
  readonly inst: NewInstitution;
  /** 2010 in-state sticker (tuition + mandatory fees). Private: same as out. */
  readonly inState2010: number;
  readonly outState2010: number;
  /** 2010 average net price after aid. */
  readonly net2010: number;
  /** Annual sticker growth (net grows 1pt slower as aid rises). */
  readonly growth: number;
}

const START_YEAR = 2010;
const END_YEAR = 2024;

const SPECS: readonly SeedSpec[] = [
  {
    inst: {
      ipedsUnitId: 243744,
      name: "Stanford University",
      city: "Stanford",
      state: "CA",
      sector: "private",
      institutionType: "four_year",
      websiteUrl: "https://www.stanford.edu",
      opeid: "00130500",
    },
    inState2010: 40_050,
    outState2010: 40_050,
    net2010: 14_800,
    growth: 0.037,
  },
  {
    inst: {
      ipedsUnitId: 110635,
      name: "University of California-Berkeley",
      city: "Berkeley",
      state: "CA",
      sector: "public",
      institutionType: "four_year",
      websiteUrl: "https://www.berkeley.edu",
      opeid: "00131200",
    },
    inState2010: 11_300,
    outState2010: 34_200,
    net2010: 16_400,
    growth: 0.045,
  },
  {
    inst: {
      ipedsUnitId: 170976,
      name: "University of Michigan-Ann Arbor",
      city: "Ann Arbor",
      state: "MI",
      sector: "public",
      institutionType: "four_year",
      websiteUrl: "https://umich.edu",
      opeid: "00232500",
    },
    inState2010: 12_600,
    outState2010: 37_800,
    net2010: 16_900,
    growth: 0.043,
  },
  {
    inst: {
      ipedsUnitId: 228778,
      name: "The University of Texas at Austin",
      city: "Austin",
      state: "TX",
      sector: "public",
      institutionType: "four_year",
      websiteUrl: "https://www.utexas.edu",
      opeid: "00365800",
    },
    inState2010: 9_800,
    outState2010: 33_800,
    net2010: 15_100,
    growth: 0.041,
  },
  {
    inst: {
      ipedsUnitId: 193900,
      name: "New York University",
      city: "New York",
      state: "NY",
      sector: "private",
      institutionType: "four_year",
      websiteUrl: "https://www.nyu.edu",
      opeid: "00273900",
    },
    inState2010: 41_600,
    outState2010: 41_600,
    net2010: 33_200,
    growth: 0.038,
  },
  {
    inst: {
      ipedsUnitId: 204796,
      name: "Ohio State University-Main Campus",
      city: "Columbus",
      state: "OH",
      sector: "public",
      institutionType: "four_year",
      websiteUrl: "https://www.osu.edu",
      opeid: "00309000",
    },
    inState2010: 9_400,
    outState2010: 24_900,
    net2010: 16_200,
    growth: 0.039,
  },
  {
    inst: {
      ipedsUnitId: 139755,
      name: "Georgia Institute of Technology-Main Campus",
      city: "Atlanta",
      state: "GA",
      sector: "public",
      institutionType: "four_year",
      websiteUrl: "https://www.gatech.edu",
      opeid: "00160300",
    },
    inState2010: 8_300,
    outState2010: 27_800,
    net2010: 14_400,
    growth: 0.046,
  },
  {
    inst: {
      ipedsUnitId: 166683,
      name: "Williams College",
      city: "Williamstown",
      state: "MA",
      sector: "private",
      institutionType: "four_year",
      websiteUrl: "https://www.williams.edu",
      opeid: "00220900",
    },
    inState2010: 41_400,
    outState2010: 41_400,
    net2010: 16_100,
    growth: 0.036,
  },
  {
    inst: {
      ipedsUnitId: 122612,
      name: "Santa Monica College",
      city: "Santa Monica",
      state: "CA",
      sector: "public",
      institutionType: "two_year",
      websiteUrl: "https://www.smc.edu",
      opeid: "00122300",
    },
    inState2010: 1_080,
    outState2010: 6_500,
    net2010: 4_200,
    growth: 0.048,
  },
  {
    inst: {
      ipedsUnitId: 135717,
      name: "Miami Dade College",
      city: "Miami",
      state: "FL",
      sector: "public",
      institutionType: "two_year",
      websiteUrl: "https://www.mdc.edu",
      opeid: "00159300",
    },
    inState2010: 2_400,
    outState2010: 8_900,
    net2010: 3_100,
    growth: 0.044,
  },
];

function money(value: number): string {
  return value.toFixed(2);
}

async function seedInstitution(spec: SeedSpec): Promise<number> {
  const institutions = createInstitutionRepository(db);
  await institutions.bulkInsert([spec.inst]);
  const row = await institutions.findByUnitId(spec.inst.ipedsUnitId);
  if (row === null) {
    throw new Error(`failed to upsert institution ${spec.inst.name}`);
  }
  const institutionId = row.id;

  const rates: (typeof tuitionRates.$inferInsert)[] = [];
  const nets: (typeof netPriceData.$inferInsert)[] = [];
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const t = (1 + spec.growth) ** (year - START_YEAR);
    const netT = (1 + (spec.growth - 0.01)) ** (year - START_YEAR);
    rates.push({
      institutionId,
      academicYear: year,
      residencyStatus: "in_state",
      tuitionAmount: money(spec.inState2010 * t),
      sourceType: "api",
      sourceUrl: spec.inst.websiteUrl ?? null,
      confidenceScore: "0.95",
    });
    rates.push({
      institutionId,
      academicYear: year,
      residencyStatus: "out_of_state",
      tuitionAmount: money(spec.outState2010 * t),
      sourceType: "api",
      sourceUrl: spec.inst.websiteUrl ?? null,
      confidenceScore: "0.95",
    });
    const net = spec.net2010 * netT;
    nets.push({
      institutionId,
      academicYear: year,
      incomeBracket: null,
      netPriceAmount: money(net),
      averageAidAmount: money(Math.max(0, spec.inState2010 * t - net)),
      dataSource: "scorecard",
    });
  }

  await db.insert(tuitionRates).values(rates).onConflictDoNothing();
  await db.insert(netPriceData).values(nets).onConflictDoNothing();
  await recomputeInstitution(institutionId);
  return institutionId;
}

async function main(): Promise<void> {
  console.warn(
    `Seeding ${String(SPECS.length)} institutions with ${String(END_YEAR - START_YEAR + 1)} years each…`,
  );
  for (const spec of SPECS) {
    await seedInstitution(spec);
    console.warn(`  ✓ ${spec.inst.name}`);
  }

  console.warn("Recomputing segment aggregates…");
  const residencies = ["in_state", "out_of_state"] as const;
  const cohorts = [
    ...residencies.map((r) => ({
      sector: null,
      institutionType: null,
      state: null,
      residencyStatus: r,
    })),
    ...residencies.map((r) => ({
      sector: "public" as const,
      institutionType: null,
      state: null,
      residencyStatus: r,
    })),
    ...residencies.map((r) => ({
      sector: "private" as const,
      institutionType: null,
      state: null,
      residencyStatus: r,
    })),
    ...residencies.map((r) => ({
      sector: null,
      institutionType: "four_year" as const,
      state: null,
      residencyStatus: r,
    })),
  ];
  for (const cohort of cohorts) {
    await recomputeSegment(cohort);
  }

  console.warn("✓ Dev seed complete.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("✗ Dev seed failed:", error);
  process.exit(1);
});
