import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseCsvRecords } from "./csv";
import { env } from "./env";
import { createInstitutionRepository } from "./repositories/institutions";
import * as schema from "./schema";
import type { NewInstitution } from "./schema/institutions";

/**
 * Institution seeder (TUIT-3 AC #4). Two modes:
 *
 *   pnpm seed --file <path-to-IPEDS-HD.csv>   # production: real directory data
 *   pnpm seed --synthetic <n>                 # dev/perf: n deterministic rows
 *
 * Idempotent: institutions dedupe on ipeds_unit_id, so re-running is safe.
 */

const CHUNK = 1000;

/** Map an IPEDS HD directory record to a canonical institution row. */
function fromIpedsRecord(rec: Record<string, string>): NewInstitution | null {
  const unitId = Number.parseInt(rec.UNITID ?? "", 10);
  const name = (rec.INSTNM ?? "").trim();
  const state = (rec.STABBR ?? "").trim().toUpperCase();
  if (!Number.isInteger(unitId) || name === "" || state.length !== 2) {
    return null;
  }
  // IPEDS CONTROL: 1 = public, 2 = private nonprofit, 3 = private for-profit.
  const sector = rec.CONTROL === "1" ? "public" : "private";
  // IPEDS ICLEVEL: 1 = 4-year, 2 = 2-year, 3 = < 2-year (folded into two_year).
  const institutionType = rec.ICLEVEL === "1" ? "four_year" : "two_year";
  const opeid = (rec.OPEID ?? "").trim().slice(0, 8);
  const web = (rec.WEBADDR ?? "").trim();

  return {
    ipedsUnitId: unitId,
    name,
    city: (rec.CITY ?? "").trim() || null,
    state,
    sector,
    institutionType,
    opeid: opeid === "" ? null : opeid,
    websiteUrl: web === "" ? null : web,
  };
}

/** Deterministic pseudo-random institutions for local dev and perf testing. */
function generateSynthetic(count: number): NewInstitution[] {
  const states = ["CA", "TX", "NY", "FL", "IL", "PA", "OH", "MI", "GA", "NC"];
  const sectors = ["public", "private"] as const;
  const types = ["two_year", "four_year"] as const;
  const rows: NewInstitution[] = [];
  for (let i = 0; i < count; i += 1) {
    // Base unit ids at 900000 so synthetic data never collides with real IPEDS ids.
    const unitId = 900000 + i;
    rows.push({
      ipedsUnitId: unitId,
      name: `Synthetic University ${String(i + 1)}`,
      city: "Springfield",
      state: states[i % states.length] ?? "CA",
      sector: sectors[i % sectors.length] ?? "public",
      institutionType: types[i % types.length] ?? "four_year",
      opeid: String(unitId).padStart(8, "0"),
      websiteUrl: `https://inst-${String(unitId)}.example.edu`,
    });
  }
  return rows;
}

function resolveRows(argv: readonly string[]): NewInstitution[] {
  const fileIdx = argv.indexOf("--file");
  if (fileIdx !== -1) {
    const path = argv[fileIdx + 1];
    if (path === undefined) {
      throw new Error("--file requires a path to an IPEDS HD CSV");
    }
    const text = readFileSync(path, "utf8");
    return parseCsvRecords(text)
      .map(fromIpedsRecord)
      .filter((r): r is NewInstitution => r !== null);
  }

  const synthIdx = argv.indexOf("--synthetic");
  if (synthIdx !== -1) {
    const n = Number.parseInt(argv[synthIdx + 1] ?? "", 10);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error("--synthetic requires a positive integer count");
    }
    return generateSynthetic(n);
  }

  throw new Error("Usage: seed (--file <path> | --synthetic <n>)");
}

async function main(): Promise<void> {
  const rows = resolveRows(process.argv.slice(2));
  const client = postgres(env.DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const repo = createInstitutionRepository(db);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      inserted += await repo.bulkInsert(rows.slice(i, i + CHUNK));
    }
    console.warn(`✓ Seeded ${String(inserted)} institutions (${String(rows.length)} processed).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Seed failed:", error);
  process.exit(1);
});
