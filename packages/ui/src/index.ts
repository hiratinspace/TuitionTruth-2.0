/**
 * @tuitiontruth/ui — design system.
 *
 * The token layer (color/type/motion/spacing) plus the presentational
 * primitives (TUIT-29): Card, Badge, Button, Skeleton, ProvenanceChip,
 * DirectionIndicator, InsufficientData — and the pure formatters and chart
 * geometry that keep every number and line consistent across the app.
 */
export {
  colorTokens,
  fontTokens,
  motionTokens,
  typeScale,
  type ColorToken,
  type FontToken,
} from "./tokens";

export {
  formatCurrency,
  formatCurrencyCents,
  formatPercent,
  formatAcademicYear,
  formatYearRange,
  directionOf,
  type Direction,
} from "./format";

export { type MetricView, type Provenance } from "./types";

export { cn } from "./primitives/cn";
export { Card, type CardProps } from "./primitives/Card";
export { Badge, type BadgeProps, type BadgeTone } from "./primitives/Badge";
export { Button, type ButtonProps, type ButtonVariant } from "./primitives/Button";
export { Skeleton, type SkeletonProps } from "./primitives/Skeleton";
export { ProvenanceChip, type ProvenanceChipProps } from "./primitives/ProvenanceChip";
export { DirectionIndicator, type DirectionIndicatorProps } from "./primitives/DirectionIndicator";
export { InsufficientData, type InsufficientDataProps } from "./primitives/InsufficientData";

export {
  type ChartPoint,
  type ScaledPoint,
  type PlotArea,
  type Insets,
  type Domain,
  type PathSegment,
  padDomain,
  yearDomain,
  valueDomain,
  linearScale,
  scalePoints,
  buildLineSegments,
  axisTicks,
} from "./chart/geometry";
export { TrendChart, type TrendChartProps, type TrendSeries } from "./chart/TrendChart";
export { TrendChartInteractive } from "./chart/TrendChartInteractive";

export { CountUp, type CountUpProps } from "./motion/CountUp";
export { clamp01, easeOutCubic, countUpValue } from "./motion/easing";
