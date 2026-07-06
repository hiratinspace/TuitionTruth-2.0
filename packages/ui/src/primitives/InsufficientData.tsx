import { cn } from "./cn";

export interface InsufficientDataProps {
  /** The typed reason from the Metric — surfaced, not hidden. */
  readonly reason: string;
  readonly className?: string;
  /** Compact inline form for tight card slots. */
  readonly compact?: boolean;
}

/**
 * The honest empty state. Where a value would go, this renders an explicit
 * "not enough data" marker carrying the reason — the visual counterpart to the
 * `insufficient_data` metric. It is deliberately quiet (muted, dashed) so a gap
 * reads as a known limit, not an error (§2.3 null discipline).
 */
export function InsufficientData({ reason, className, compact = false }: InsufficientDataProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-dashed border-border font-data text-ink/50",
        compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        className,
      )}
      title={reason}
    >
      <span aria-hidden="true">—</span>
      <span className={compact ? "sr-only" : undefined}>
        <span className="sr-only">Insufficient data: </span>
        {compact ? reason : "not enough data"}
      </span>
    </span>
  );
}
