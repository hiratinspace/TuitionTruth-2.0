import type { ReactNode } from "react";
import {
  Card,
  DirectionIndicator,
  formatAcademicYear,
  formatCurrency,
  ProvenanceChip,
} from "@tuitiontruth/ui";
import type { AnalyticsMetrics } from "@/lib/api-client";
import { MetricNumber } from "./MetricNumber";

function Stat({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Card interactive className="p-4">
      <div className="font-data text-xs uppercase tracking-wider text-ink/50">{label}</div>
      <div className="mt-2 font-data text-xl font-medium tabular-nums text-ink">{children}</div>
    </Card>
  );
}

/**
 * The "Big 5" headline metrics (§3.2): sticker, 5- and 10-year CAGR, YoY, and
 * the forward projection. Every cell renders through `MetricNumber`, so an
 * institution missing history shows explicit insufficient-data states rather
 * than fabricated numbers. CAGR/YoY use `DirectionIndicator` (arrow + text +
 * color), never color alone.
 */
export function BigFive({ metrics }: { readonly metrics: AnalyticsMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Stat label="Sticker">
        <MetricNumber metric={metrics.latestSticker} render={(v) => formatCurrency(v)} />
      </Stat>

      <Stat label="5-yr CAGR">
        <MetricNumber
          metric={metrics.cagr5yr}
          render={(c) => <DirectionIndicator rate={c.rate} />}
        />
      </Stat>

      <Stat label="10-yr CAGR">
        <MetricNumber
          metric={metrics.cagr10yr}
          render={(c) => <DirectionIndicator rate={c.rate} />}
        />
      </Stat>

      <Stat label="Year over year">
        <MetricNumber metric={metrics.yoy} render={(y) => <DirectionIndicator rate={y.rate} />} />
      </Stat>

      <Stat label="Projected">
        <MetricNumber
          metric={metrics.projection}
          render={(p) => (
            <span className="inline-flex flex-col items-start gap-1">
              <span>{formatCurrency(p.projectedValue)}</span>
              <ProvenanceChip
                provenance={{
                  asOf: formatAcademicYear(p.targetYear),
                  source: "estimate",
                  extractedAt: p.methodology,
                }}
              />
            </span>
          )}
        />
      </Stat>
    </div>
  );
}
