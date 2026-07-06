import { combineMetrics, type Metric } from "./metric";
import { cagrForWindow, type CagrResult } from "./cagr";
import { netPriceGap, type NetPriceResult } from "./net-price";
import { project, type ProjectionResult } from "./projection";
import { latestValue, type DataPoint } from "./series";
import { yoyForLatest, type YoyResult } from "./yoy";

/** Trailing windows for the two headline CAGR figures (TUIT-24). */
export const CAGR_SHORT_WINDOW = 5;
export const CAGR_LONG_WINDOW = 10;

/** Inputs the composer needs to build one institution's analytics read-model. */
export interface InstitutionAnalyticsInput {
  /** Sticker-price series (tuition + mandatory fees) for the chosen residency. */
  readonly stickerSeries: readonly DataPoint[];
  /** Net-price series (sticker minus average aid). */
  readonly netSeries: readonly DataPoint[];
  /** Year the projection targets, e.g. 2030 (TUIT-25). */
  readonly projectionTargetYear: number;
}

/**
 * The precomputed "Big 5" plus supporting figures for one institution/residency.
 * Every field is a `Metric` so an institution missing, say, ten years of history
 * still yields a fully-typed row — the gaps are explicit insufficient-data
 * states, never zeros. This is the exact shape the snapshot job serialises into
 * `analytics_snapshots` and the API streams to the profile page.
 */
export interface InstitutionAnalytics {
  readonly latestSticker: Metric<number>;
  readonly latestNet: Metric<number>;
  readonly discount: Metric<NetPriceResult>;
  readonly cagr5yr: Metric<CagrResult>;
  readonly cagr10yr: Metric<CagrResult>;
  readonly yoy: Metric<YoyResult>;
  readonly projection: Metric<ProjectionResult>;
}

/**
 * Compose every headline metric for one institution from its raw series. Pure
 * and total: any missing input degrades to a typed insufficient-data state on
 * exactly the affected metric, leaving the rest intact. Called once per
 * institution/residency at ingest time (§2.3), so the request path only ever
 * reads the serialised result.
 */
export function computeInstitutionAnalytics(
  input: InstitutionAnalyticsInput,
): InstitutionAnalytics {
  const latestSticker = latestValue(input.stickerSeries);
  const latestNet = latestValue(input.netSeries);
  return {
    latestSticker,
    latestNet,
    discount: combineMetrics(latestSticker, latestNet, netPriceGap),
    cagr5yr: cagrForWindow(input.stickerSeries, CAGR_SHORT_WINDOW),
    cagr10yr: cagrForWindow(input.stickerSeries, CAGR_LONG_WINDOW),
    yoy: yoyForLatest(input.stickerSeries),
    projection: project(input.stickerSeries, input.projectionTargetYear, CAGR_SHORT_WINDOW),
  };
}
