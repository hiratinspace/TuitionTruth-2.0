/**
 * @tuitiontruth/analytics-core
 *
 * Pure, I/O-free tuition mathematics. No database, no HTTP, no side effects —
 * every export is a deterministic function or type, which is what lets the
 * suite hold a 100% coverage bar. The CAGR / YoY / net-price / projection /
 * segmentation engines (TUIT-21..25) all return `Metric<T>`, so every
 * "insufficient data" path is typed and surfaced, never a silent 0 or null.
 */
export { type Metric, ok, insufficient, isOk, mapMetric, unwrapOr, combineMetrics } from "./metric";
export { type DataPoint, sortByYear, findByYear, latestValue } from "./series";
export { PROJECTION_INCREMENT, roundToNearest } from "./money";
export { type CagrResult, computeCagr, cagrForWindow } from "./cagr";
export { type YoyResult, yoyForLatest } from "./yoy";
export { type NetPriceResult, netPriceGap } from "./net-price";
export { type ProjectionResult, project } from "./projection";
export { type SegmentStats, segmentStats } from "./segmentation";
export {
  type InstitutionAnalytics,
  type InstitutionAnalyticsInput,
  computeInstitutionAnalytics,
  CAGR_SHORT_WINDOW,
  CAGR_LONG_WINDOW,
} from "./analytics";
