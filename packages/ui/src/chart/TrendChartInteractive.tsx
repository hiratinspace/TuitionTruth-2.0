"use client";

import { useMemo, useRef, useState } from "react";
import { formatCurrency } from "../format";
import { cn } from "../primitives/cn";
import {
  DEFAULT_INSETS,
  padDomain,
  scalePoints,
  valueDomain,
  yearDomain,
  type Domain,
  type PlotArea,
} from "./geometry";
import { TrendChart, type TrendChartProps, type TrendSeries } from "./TrendChart";

const STROKE: Record<TrendSeries["variant"], string> = {
  sticker: "var(--color-ink)",
  net: "var(--color-primary)",
};

/**
 * Interactive wrapper over the static {@link TrendChart}. Adds a hover/keyboard
 * crosshair with a value tooltip and an aria-live readout, while the underlying
 * static chart remains the accessible + crawlable baseline (its hidden data
 * table). Pointer coordinates are mapped back through the same geometry, so the
 * crosshair lands exactly on the rendered points. Entrance draw is CSS-only and
 * collapses under prefers-reduced-motion.
 */
export function TrendChartInteractive(props: TrendChartProps) {
  const { series, width = 640, height = 280 } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const yd = yearDomain(all);
    const vd = valueDomain(all);
    if (yd === null || vd === null) {
      return null;
    }
    const plot: PlotArea = { width, height, insets: DEFAULT_INSETS };
    const yDomain = padDomain(vd);
    const xDomain: Domain = yd;
    const years = [...new Set(all.map((p) => p.year))].sort((a, b) => a - b);
    const xs = scalePoints(
      years.map((year) => ({ year, value: vd[0] })),
      xDomain,
      yDomain,
      plot,
    ).map((p) => p.x);
    const byYear = series.map((s) => ({
      series: s,
      values: new Map(s.points.map((p) => [p.year, p.value])),
    }));
    return { plot, xDomain, yDomain, years, xs, byYear };
  }, [series, width, height]);

  if (model === null) {
    return <TrendChart {...props} />;
  }

  const hy = hoverIndex === null ? undefined : model.years[hoverIndex];
  const hx = hoverIndex === null ? undefined : model.xs[hoverIndex];
  const hovered = hy !== undefined && hx !== undefined ? { year: hy, x: hx } : null;
  const lastIndex = model.years.length - 1;

  function locate(clientX: number): void {
    const svg = svgRef.current;
    if (svg === null) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const vbX = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDistance = Infinity;
    model?.xs.forEach((x, i) => {
      const distance = Math.abs(x - vbX);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setHoverIndex(best);
  }

  return (
    <div className="relative">
      <TrendChart {...props} className={cn("chart-reveal", props.className)} />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Chart values by year — use the left and right arrow keys to inspect each year"
        tabIndex={0}
        className="absolute inset-0 cursor-crosshair rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        onPointerMove={(event) => {
          locate(event.clientX);
        }}
        onPointerLeave={() => {
          setHoverIndex(null);
        }}
        onFocus={() => {
          setHoverIndex((current) => current ?? lastIndex);
        }}
        onBlur={() => {
          setHoverIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setHoverIndex((current) => Math.min((current ?? -1) + 1, lastIndex));
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            setHoverIndex((current) => Math.max((current ?? lastIndex + 1) - 1, 0));
          }
        }}
      >
        {hovered !== null && (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={DEFAULT_INSETS.top}
              y2={height - DEFAULT_INSETS.bottom}
              stroke="var(--color-ink)"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            {model.byYear.map(({ series: s, values }) => {
              const value = values.get(hovered.year);
              if (value === undefined) {
                return null;
              }
              const y =
                scalePoints(
                  [{ year: hovered.year, value }],
                  model.xDomain,
                  model.yDomain,
                  model.plot,
                )[0]?.y ?? 0;
              return (
                <circle
                  key={s.id}
                  cx={hovered.x}
                  cy={y}
                  r={4}
                  fill={STROKE[s.variant]}
                  stroke="var(--color-paper)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}
      </svg>

      {hovered !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-28 -translate-x-1/2 rounded-[var(--radius)] border border-border bg-paper px-3 py-2 shadow-md"
          style={{ left: `${String((hovered.x / width) * 100)}%` }}
        >
          <div className="font-data text-xs font-medium text-ink">{hovered.year}</div>
          {model.byYear.map(({ series: s, values }) => {
            const value = values.get(hovered.year);
            return (
              <div key={s.id} className="mt-0.5 flex justify-between gap-3 font-data text-xs">
                <span className="text-ink/60">{s.label}</span>
                <span className="tabular-nums text-ink">
                  {value === undefined ? "—" : formatCurrency(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {hovered === null
          ? ""
          : `${String(hovered.year)}: ${model.byYear
              .map(({ series: s, values }) => {
                const value = values.get(hovered.year);
                return `${s.label} ${value === undefined ? "no data" : formatCurrency(value)}`;
              })
              .join(", ")}`}
      </span>
    </div>
  );
}
