import {
  CAGR_LONG_WINDOW,
  computeInstitutionAnalytics,
  segmentStats,
  type DataPoint,
} from "@tuitiontruth/analytics-core";
import {
  createAnalyticsSnapshotRepository,
  createNetPriceRepository,
  createTuitionRateRepository,
  db,
  residencyStatusEnum,
  type SegmentCohort,
} from "@tuitiontruth/db";
import { toSnapshotRow } from "./serialize";

type ResidencyStatus = (typeof residencyStatusEnum.enumValues)[number];

const RESIDENCIES: readonly ResidencyStatus[] = residencyStatusEnum.enumValues;

/**
 * The year projections target. Derived from the newest observed year plus the
 * long CAGR window, so "projected 2030"-style headlines stay a fixed horizon
 * ahead of the data rather than drifting (TUIT-25).
 */
export function projectionTargetYear(latestYear: number): number {
  return latestYear + CAGR_LONG_WINDOW;
}

/**
 * Convert numeric-string rows into a value-space series, dropping rows whose
 * amount is null or unparseable. Pure and exported so the mapping — the one
 * place DB representation meets analytics-core — is unit-tested directly.
 */
export function rowsToSeries<Row>(
  rows: readonly Row[],
  getYear: (row: Row) => number,
  getAmount: (row: Row) => string | null,
): DataPoint[] {
  const series: DataPoint[] = [];
  for (const row of rows) {
    const amount = getAmount(row);
    if (amount === null) {
      continue;
    }
    const value = Number(amount);
    if (Number.isFinite(value)) {
      series.push({ year: getYear(row), value });
    }
  }
  return series;
}

/** The most recent year in a series, or null when the series is empty. */
export function latestYearOf(series: readonly DataPoint[]): number | null {
  if (series.length === 0) {
    return null;
  }
  return Math.max(...series.map((point) => point.year));
}

/**
 * Recompute and persist both residency snapshots for one institution (§2.3).
 * Runs after an ETL batch + QA approval; idempotent by construction (the
 * repository upserts on the natural key), so a re-run overwrites in place.
 */
export async function recomputeInstitution(institutionId: number): Promise<void> {
  const tuitionRepo = createTuitionRateRepository(db);
  const netRepo = createNetPriceRepository(db);
  const snapshotRepo = createAnalyticsSnapshotRepository(db);

  const netRows = await netRepo.getAggregateHistory(institutionId);
  const netSeries = rowsToSeries(
    netRows,
    (row) => row.academicYear,
    (row) => row.netPriceAmount,
  );

  for (const residency of RESIDENCIES) {
    const tuitionRows = await tuitionRepo.getHistory(institutionId, residency);
    const stickerSeries = rowsToSeries(
      tuitionRows,
      (row) => row.academicYear,
      (row) => row.tuitionAmount,
    );
    const latestYear = latestYearOf(stickerSeries);
    const analytics = computeInstitutionAnalytics({
      stickerSeries,
      netSeries,
      // With no observed year there is nothing to anchor a projection to; the
      // analytics still return typed insufficient-data states, so any horizon
      // is safe. Use the long window as a stable placeholder.
      projectionTargetYear: projectionTargetYear(latestYear ?? new Date().getUTCFullYear()),
    });
    await snapshotRepo.upsert(
      toSnapshotRow(institutionId, residency, latestYear, analytics, { stickerSeries, netSeries }),
    );
  }
}

/**
 * Recompute and persist one segment cohort's aggregate stats from the
 * already-computed per-institution snapshots. Returns false (and writes
 * nothing) for an empty cohort — the constraint that a segment row has a
 * positive count is upheld in code, not left to the DB to reject.
 */
export async function recomputeSegment(cohort: SegmentCohort): Promise<boolean> {
  const snapshotRepo = createAnalyticsSnapshotRepository(db);
  const stickers = await snapshotRepo.listCohortStickers(cohort);
  const stats = segmentStats(stickers);
  if (stats.status === "insufficient_data") {
    return false;
  }
  await snapshotRepo.upsertSegment({
    sector: cohort.sector,
    institutionType: cohort.institutionType,
    state: cohort.state,
    residencyStatus: cohort.residencyStatus,
    institutionCount: stats.value.count,
    meanSticker: stats.value.mean.toFixed(2),
    medianSticker: stats.value.median.toFixed(2),
    minSticker: stats.value.min.toFixed(2),
    maxSticker: stats.value.max.toFixed(2),
  });
  return true;
}
