import { formatCurrency } from "../format";
import { cn } from "../primitives/cn";
import {
  axisTicks,
  buildLineSegments,
  padDomain,
  scalePoints,
  valueDomain,
  yearDomain,
  type ChartPoint,
  type Domain,
  type PlotArea,
} from "./geometry";

export interface TrendSeries {
  readonly id: string;
  readonly label: string;
  readonly points: readonly ChartPoint[];
  /** `sticker` draws a solid ink line; `net` a dashed primary line. */
  readonly variant: "sticker" | "net";
}

export interface TrendChartProps {
  readonly series: readonly TrendSeries[];
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}

const INSETS = { top: 12, right: 16, bottom: 28, left: 64 };

const STROKE: Record<TrendSeries["variant"], string> = {
  sticker: "var(--color-ink)",
  net: "var(--color-primary)",
};
// Distinct dash patterns so series are never distinguished by hue alone (§3.2).
const DASH: Record<TrendSeries["variant"], string | undefined> = {
  sticker: undefined,
  net: "6 4",
};

/**
 * Multi-series tuition trend chart. Pure SVG — no chart library — chosen so gap
 * rendering (dashed "no data" segments), dual sticker/net encoding, and exact
 * token theming stay under our control against a small (≤15pt) dataset (ADR
 * 0003). Server-renderable; a visually-hidden table mirrors the data for
 * screen readers and SEO.
 */
export function TrendChart({
  series,
  width = 640,
  height = 280,
  className,
  ariaLabel = "Tuition trend over time",
}: TrendChartProps) {
  const plot: PlotArea = { width, height, insets: INSETS };

  const allPoints = series.flatMap((s) => s.points);
  const years = yearDomain(allPoints);
  const values = valueDomain(allPoints);

  if (years === null || values === null) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--radius)] border border-dashed border-border font-data text-sm text-ink/50",
          className,
        )}
        style={{ height }}
      >
        No trend data available
      </div>
    );
  }

  const yDomain = padDomain(values);
  const xDomain: Domain = years;
  const yTicks = axisTicks(yDomain, 4);

  return (
    <figure className={cn("m-0", className)}>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Horizontal gridlines + dollar labels */}
        {yTicks.map((tick) => {
          const y =
            scalePoints([{ year: xDomain[0], value: tick }], xDomain, yDomain, plot)[0]?.y ?? 0;
          return (
            <g key={`grid-${String(tick)}`}>
              <line
                x1={INSETS.left}
                x2={width - INSETS.right}
                y1={y}
                y2={y}
                stroke="var(--color-muted)"
                strokeWidth={1}
              />
              <text
                x={INSETS.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="font-data"
                fontSize={11}
                fill="var(--color-ink)"
                opacity={0.55}
              >
                {formatCurrency(tick)}
              </text>
            </g>
          );
        })}

        {/* X axis endpoints */}
        {[xDomain[0], xDomain[1]].map((year, i) => (
          <text
            key={`x-${String(year)}`}
            x={i === 0 ? INSETS.left : width - INSETS.right}
            y={height - 8}
            textAnchor={i === 0 ? "start" : "end"}
            className="font-data"
            fontSize={11}
            fill="var(--color-ink)"
            opacity={0.55}
          >
            {year}
          </text>
        ))}

        {/* Series */}
        {series.map((s) => {
          const scaled = scalePoints(s.points, xDomain, yDomain, plot);
          const segments = buildLineSegments(scaled);
          return (
            <g key={s.id}>
              {segments.map((seg, i) => (
                <path
                  key={`${s.id}-seg-${String(i)}`}
                  d={seg.d}
                  fill="none"
                  stroke={STROKE[s.variant]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={seg.kind === "gap" ? "2 5" : DASH[s.variant]}
                  opacity={seg.kind === "gap" ? 0.4 : 1}
                />
              ))}
              {scaled.map((point) => (
                <circle
                  key={`${s.id}-pt-${String(point.year)}`}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  fill="var(--color-paper)"
                  stroke={STROKE[s.variant]}
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Accessible + crawlable equivalent of the visual series. */}
      <figcaption className="sr-only">
        {series.map((s) => (
          <table key={`tbl-${s.id}`}>
            <caption>{s.label}</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.points.map((point) => (
                <tr key={`${s.id}-row-${String(point.year)}`}>
                  <td>{point.year}</td>
                  <td>{formatCurrency(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </figcaption>
    </figure>
  );
}
